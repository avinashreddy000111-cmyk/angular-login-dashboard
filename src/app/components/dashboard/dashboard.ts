// src/app/components/dashboard/dashboard.ts

import { Component, inject, signal, computed, OnDestroy, OnInit, effect, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subscription, interval } from 'rxjs';
import { AuthService } from '../../services/auth';
import { FileProcessingService, RequestTimeoutError } from '../../services/file-processing';
import { 
  ProcessingResponse,
  ProcessingResponseItem, 
  DashboardFormData,
  TransactionType,
  OrderType,
  FormatType,
  ResponseType
} from '../../models/interfaces';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss'
})
export class DashboardComponent implements OnInit, OnDestroy {
  private router = inject(Router);
  authService = inject(AuthService);
  private fileService = inject(FileProcessingService);

  // Subscription management for cleanup
  private currentRequest: Subscription | null = null;
  private countdownSubscription: Subscription | null = null;
  private idleTimerSubscription: Subscription | null = null;

  // Countdown timer for processing
  remainingSeconds = signal<number>(60);
  private readonly TIMEOUT_SECONDS = 60;

  // Idle timeout configuration (5 minutes = 300 seconds)
  private readonly IDLE_TIMEOUT_SECONDS = 300;
  private lastActivityTime = Date.now();

  // Enum references for template
  TransactionType = TransactionType;
  OrderType = OrderType;
  FormatType = FormatType;
  ResponseType = ResponseType;

  // Dropdown options
  transactionTypes = Object.values(TransactionType);
  orderTypes = Object.values(OrderType);
  formats = Object.values(FormatType);

  // Define response types for each transaction type
  // ORDER: ACK, SHIPCONFIRM
  private readonly orderResponseTypes: ResponseType[] = [
    ResponseType.ACK,
    ResponseType.SHIPCONFIRM
  ];

  // ASN: ACK, RECEIPT
  private readonly asnResponseTypes: ResponseType[] = [
    ResponseType.ACK,
    ResponseType.RECEIPT
  ];

  // ITEM: ACK only
  private readonly itemResponseTypes: ResponseType[] = [
    ResponseType.ACK
  ];

  // GETSCHEMA: ASN, ORDER, SHIPCONFIRM, RECEIPT, ITEM
  private readonly getSchemaResponseTypes: ResponseType[] = [
    ResponseType.ASN,
    ResponseType.ORDER,
    ResponseType.SHIPCONFIRM,
    ResponseType.RECEIPT,
    ResponseType.ITEM
  ];

  // Selected values using enums
  selectedTransactionType = signal<TransactionType>(TransactionType.ORDER);
  selectedOrderType = signal<OrderType>(OrderType.LTL);
  selectedFormat = signal<FormatType>(FormatType.EDI);
  selectedResponseType = signal<ResponseType>(ResponseType.ACK);

  selectedFile = signal<File | null>(null);
  isDragOver = signal(false);

  isProcessing = signal(false);
  
  // Array of results
  processedResults = signal<ProcessingResponseItem[]>([]);
  
  errorMessage = signal<string | null>(null);
  
  // Flag to indicate if the error is a timeout
  isTimeoutError = signal(false);

  // Track current request UUID for error messages
  currentUUID = signal<string | null>(null);

  // Computed: Check if there are any results
  hasResults = computed(() => this.processedResults().length > 0);

  // Computed: Get filtered response types based on transaction type
  filteredResponseTypes = computed(() => {
    switch (this.selectedTransactionType()) {
      case TransactionType.ORDER:
        return this.orderResponseTypes;
      case TransactionType.ASN:
        return this.asnResponseTypes;
      case TransactionType.ITEM:
        return this.itemResponseTypes;
      case TransactionType.GETSCHEMA:
        return this.getSchemaResponseTypes;
      default:
        return this.orderResponseTypes;
    }
  });

  // Computed: Show ORDER TYPE dropdown AFTER Transaction Type (when Transaction Type is ORDER)
  showOrderTypeAfterTransaction = computed(() => {
    return this.selectedTransactionType() === TransactionType.ORDER;
  });

  // Computed: Show ORDER TYPE dropdown AFTER Response Type (when Response Type is ORDER for GETSCHEMA)
  showOrderTypeAfterResponse = computed(() => {
    const transactionType = this.selectedTransactionType();
    const responseType = this.selectedResponseType();
    
    return transactionType === TransactionType.GETSCHEMA &&
           responseType === ResponseType.ORDER;
  });

  // Computed: Check if file input should be disabled (for GETSCHEMA)
  isFileInputDisabled = computed(() => {
    const transactionType = this.selectedTransactionType();
    return transactionType === TransactionType.GETSCHEMA;
  });

  // Computed: Check if process button should be disabled
  isProcessDisabled = computed(() => {
    // If GETSCHEMA, ERRORRESPONSE, ERRORTIMEOUT - don't need file, always enabled
    if (this.isFileInputDisabled()) {
      return false;
    }
    // For other types, need a file
    return !this.selectedFile();
  });

  constructor() {
    // Effect to reset response type when transaction type changes
    // and current response type is not valid for new transaction type
    effect(() => {
      const currentTransactionType = this.selectedTransactionType();
      const currentResponseType = this.selectedResponseType();
      
      let validResponseTypes: ResponseType[];
      switch (currentTransactionType) {
        case TransactionType.ORDER:
          validResponseTypes = this.orderResponseTypes;
          break;
        case TransactionType.ASN:
          validResponseTypes = this.asnResponseTypes;
          break;
        case TransactionType.ITEM:
          validResponseTypes = this.itemResponseTypes;
          break;
        case TransactionType.GETSCHEMA:
          validResponseTypes = this.getSchemaResponseTypes;
          break;
        default:
          validResponseTypes = this.orderResponseTypes;
      }

      // If current response type is not valid for the new transaction type, reset to first option
      if (!validResponseTypes.includes(currentResponseType)) {
        this.selectedResponseType.set(validResponseTypes[0]);
      }
    }, { allowSignalWrites: true });
  }

  ngOnInit(): void {
    // Start the idle timer when component initializes
    this.startIdleTimer();
  }

  // ========== IDLE TIMEOUT - AUTO LOGOUT ==========

  /**
   * Listen for user activity events to reset idle timer
   */
  @HostListener('window:mousemove')
  @HostListener('window:click')
  @HostListener('window:keypress')
  @HostListener('window:keydown')
  @HostListener('window:scroll')
  @HostListener('window:touchstart')
  @HostListener('document:visibilitychange')
  onUserActivity(): void {
    this.resetIdleTimer();
  }

  /**
   * Start the idle timer - checks every second if user has been idle
   */
  private startIdleTimer(): void {
    this.lastActivityTime = Date.now();

    // Clear any existing idle timer
    this.stopIdleTimer();

    // Check every second if user has been idle for too long
    this.idleTimerSubscription = interval(1000).subscribe(() => {
      const currentTime = Date.now();
      const idleTimeSeconds = Math.floor((currentTime - this.lastActivityTime) / 1000);

      if (idleTimeSeconds >= this.IDLE_TIMEOUT_SECONDS) {
        console.log('User idle for 5 minutes. Auto-logout triggered.');
        this.autoLogout();
      }
    });
  }

  /**
   * Reset the idle timer - called on any user activity
   */
  private resetIdleTimer(): void {
    this.lastActivityTime = Date.now();
  }

  /**
   * Stop the idle timer
   */
  private stopIdleTimer(): void {
    if (this.idleTimerSubscription) {
      this.idleTimerSubscription.unsubscribe();
      this.idleTimerSubscription = null;
    }
  }

  /**
   * Auto logout due to inactivity
   */
  private autoLogout(): void {
    // Stop all timers
    this.stopIdleTimer();
    this.stopCountdown();

    // Cancel any pending request
    if (this.currentRequest) {
      this.currentRequest.unsubscribe();
      this.currentRequest = null;
    }

    // Perform logout
    this.authService.logout();
    
    // Navigate to login with a message indicating session expired
    this.router.navigate(['/login'], { 
      queryParams: { sessionExpired: 'true' } 
    });
  }

  // ========== END IDLE TIMEOUT ==========

  // Handle Transaction Type change
  onTransactionTypeChange(value: string): void {
    this.selectedTransactionType.set(value as TransactionType);
    // Reset ORDER TYPE to default when switching to ORDER
    if (value === TransactionType.ORDER) {
      this.selectedOrderType.set(OrderType.LTL);
    }
    // Clear file when switching to GETSCHEMA (doesn't need file)
    if (value === TransactionType.GETSCHEMA) {
      this.selectedFile.set(null);
      // Reset ORDER TYPE when switching to GETSCHEMA (will show again if ORDER is selected as Response Type)
      this.selectedOrderType.set(OrderType.LTL);
    }
  }

  onDragOver(event: DragEvent): void {
    if (this.isFileInputDisabled()) return;
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver.set(true);
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver.set(false);
  }

  onDrop(event: DragEvent): void {
    if (this.isFileInputDisabled()) return;
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver.set(false);
    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      this.selectedFile.set(files[0]);
      this.clearOutputState();
    }
  }

  onFileSelected(event: Event): void {
    if (this.isFileInputDisabled()) return;
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.selectedFile.set(input.files[0]);
      this.clearOutputState();
    }
  }

  removeFile(): void {
    this.selectedFile.set(null);
    this.clearOutputState();
  }

  // Handle Response Type change
  onResponseTypeChange(value: string): void {
    this.selectedResponseType.set(value as ResponseType);
    // Reset ORDER TYPE to default when Response Type changes to ORDER
    if (value === ResponseType.ORDER) {
      this.selectedOrderType.set(OrderType.LTL);
    }
  }

  /**
   * Clear output state - resets error and results
   */
  private clearOutputState(): void {
    this.errorMessage.set(null);
    this.processedResults.set([]);
    this.isTimeoutError.set(false);
    this.currentUUID.set(null);
  }

  /**
   * Start the countdown timer
   */
  private startCountdown(): void {
    this.remainingSeconds.set(this.TIMEOUT_SECONDS);
    
    // Clear any existing countdown
    this.stopCountdown();
    
    // Start new countdown - tick every second
    this.countdownSubscription = interval(1000).subscribe(() => {
      const current = this.remainingSeconds();
      if (current > 1) {
        this.remainingSeconds.set(current - 1);
      } else {
        // Countdown reached 0, trigger timeout
        this.handleCountdownTimeout();
      }
    });
  }

  /**
   * Stop the countdown timer
   */
  private stopCountdown(): void {
    if (this.countdownSubscription) {
      this.countdownSubscription.unsubscribe();
      this.countdownSubscription = null;
    }
  }

  /**
   * Handle timeout when countdown reaches 0
   */
  private handleCountdownTimeout(): void {
    this.stopCountdown();
    
    // Cancel the HTTP request
    if (this.currentRequest) {
      this.currentRequest.unsubscribe();
      this.currentRequest = null;
    }
    
    const uuid = this.currentUUID();
    const uuidSuffix = uuid ? ` (UUID=${uuid})` : '';
    
    this.errorMessage.set(`Request timed out. The server did not respond within ${this.TIMEOUT_SECONDS} seconds. Please try again.${uuidSuffix}`);
    this.isTimeoutError.set(true);
    this.isProcessing.set(false);
    this.remainingSeconds.set(this.TIMEOUT_SECONDS);
  }

  /**
   * Reset dashboard for next request
   * Called after timeout or successful processing
   */
  private resetForNextRequest(): void {
    this.isProcessing.set(false);
    this.stopCountdown();
    this.remainingSeconds.set(this.TIMEOUT_SECONDS);
    
    // Cancel any pending request
    if (this.currentRequest) {
      this.currentRequest.unsubscribe();
      this.currentRequest = null;
    }
  }

  /**
   * Cancel the current processing request
   * Called when user clicks the X button on the processing indicator
   */
  cancelRequest(): void {
    console.log('Request cancelled by user');
    
    // Stop the countdown
    this.stopCountdown();
    
    // Unsubscribe from the current request to stop it
    if (this.currentRequest) {
      this.currentRequest.unsubscribe();
      this.currentRequest = null;
    }
    
    // Reset processing state
    this.isProcessing.set(false);
    this.remainingSeconds.set(this.TIMEOUT_SECONDS);
    
    // Clear any partial state
    this.currentUUID.set(null);
    
    // Keep form values intact so user can retry or modify
  }

  /**
   * Handle request error (including timeout)
   */
  private handleRequestError(error: any): void {
    console.error('Request error:', error);
    
    const uuid = this.currentUUID();
    const uuidSuffix = uuid ? ` (UUID=${uuid})` : '';
    
    if (error instanceof RequestTimeoutError) {
      this.errorMessage.set(`Request timed out. The server did not respond within ${this.TIMEOUT_SECONDS} seconds. Please try again.${uuidSuffix}`);
      this.isTimeoutError.set(true);
    } else {
      const baseMessage = error.message || 'Processing failed. Please try again.';
      this.errorMessage.set(`${baseMessage}${uuidSuffix}`);
      this.isTimeoutError.set(false);
    }
    
    // Reset dashboard for next request
    this.resetForNextRequest();
  }

  /**
   * Process button click handler
   * Builds JSON request and sends to backend
   * Waits synchronously for response with 60-second timeout
   */
  processFile(): void {
    const transactionType = this.selectedTransactionType();
    const noFileRequired = transactionType === TransactionType.GETSCHEMA;
    const file = this.selectedFile();
    
    // For types that need file, require file
    if (!noFileRequired && !file) return;

    // Cancel any existing request
    if (this.currentRequest) {
      this.currentRequest.unsubscribe();
      this.currentRequest = null;
    }

    this.isProcessing.set(true);
    this.clearOutputState();
    
    // Start the countdown timer
    this.startCountdown();

    // Build form data for request
    const formData: DashboardFormData = {
      transactionType: this.selectedTransactionType(),
      format: this.selectedFormat(),
      responseType: this.selectedResponseType()
    };

    // Add ORDER TYPE if Transaction Type is ORDER or Response Type is ORDER
    if (this.showOrderTypeAfterTransaction() || this.showOrderTypeAfterResponse()) {
      formData.orderType = this.selectedOrderType();
    }

    // Generate UUID and store it for error tracking
    const uuid = this.fileService.generateUUID();
    this.currentUUID.set(uuid);
    console.log('Starting request... Waiting for response (timeout: 60 seconds)');
    console.log('Request UUID:', uuid);

    if (noFileRequired) {
      // GETSCHEMA - no file needed
      this.currentRequest = this.fileService.getSchema(formData, uuid).subscribe({
        next: (response) => {
          console.log('Response received successfully:', response);
          this.processedResults.set(response.response);
          this.resetForNextRequest();
        },
        error: (error) => {
          this.handleRequestError(error);
        }
      });
    } else {
      // File processing - includes Input File
      this.currentRequest = this.fileService.processFile(formData, file!, uuid).subscribe({
        next: (response) => {
          console.log('Response received successfully:', response);
          this.processedResults.set(response.response);
          this.selectedFile.set(null); // Clear input after success
          this.resetForNextRequest();
        },
        error: (error) => {
          this.handleRequestError(error);
        }
      });
    }
  }

  /**
   * Download a single file by index and remove it from the list
   */
  downloadOutput(index: number): void {
    const results = this.processedResults();
    if (!results || index >= results.length) return;
    
    const result = results[index];
    
    // Check if content is base64 encoded or plain text
    let blob: Blob;
    try {
      const byteCharacters = atob(result.content);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      // Use ArrayBuffer directly to avoid TypeScript type issues
      blob = new Blob([byteArray.buffer], { type: result.mimeType });
    } catch {
      // If not base64, use plain text
      blob = new Blob([result.content], { type: result.mimeType });
    }
    
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = result.filename;
    link.click();
    window.URL.revokeObjectURL(url);

    // Remove the downloaded file from the list
    const updatedResults = results.filter((_, i) => i !== index);
    this.processedResults.set(updatedResults);
  }

  /**
   * Download all files with staggered timing, then clear results
   */
  downloadAll(): void {
    const results = this.processedResults();
    const totalFiles = results.length;
    
    results.forEach((result, index) => {
      // Stagger downloads by 500ms to avoid browser blocking
      setTimeout(() => {
        // Download file directly without removing from list
        let blob: Blob;
        try {
          const byteCharacters = atob(result.content);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          blob = new Blob([byteArray.buffer], { type: result.mimeType });
        } catch {
          blob = new Blob([result.content], { type: result.mimeType });
        }
        
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = result.filename;
        link.click();
        window.URL.revokeObjectURL(url);

        // Clear all results after last file is downloaded
        if (index === totalFiles - 1) {
          setTimeout(() => {
            this.processedResults.set([]);
          }, 300);
        }
      }, index * 500);
    });
  }

  /**
   * Manual logout - called when user clicks logout button
   */
  logout(): void {
    // Stop all timers
    this.stopIdleTimer();
    this.stopCountdown();
    
    // Cancel any pending request before logout
    if (this.currentRequest) {
      this.currentRequest.unsubscribe();
      this.currentRequest = null;
    }
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  /**
   * Cleanup on component destroy
   */
  ngOnDestroy(): void {
    this.stopIdleTimer();
    this.stopCountdown();
    if (this.currentRequest) {
      this.currentRequest.unsubscribe();
      this.currentRequest = null;
    }
  }
}
