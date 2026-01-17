// src/app/components/dashboard/dashboard.ts

import { Component, inject, signal, computed, OnDestroy, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
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
export class DashboardComponent implements OnDestroy {
  private router = inject(Router);
  authService = inject(AuthService);
  private fileService = inject(FileProcessingService);

  // Subscription management for cleanup
  private currentRequest: Subscription | null = null;

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
  // ORDER: ACK, SHIPCONF, GETSCHEMA
  // ASN: ACK, RECEIPT, GETSCHEMA
  private readonly orderResponseTypes: ResponseType[] = [
    ResponseType.ACK,
    ResponseType.SHIPCONF,
    ResponseType.GETSCHEMA
  ];

  private readonly asnResponseTypes: ResponseType[] = [
    ResponseType.ACK,
    ResponseType.RECEIPT,
    ResponseType.GETSCHEMA
  ];

  // Selected values using enums
  selectedTransactionType = signal<TransactionType>(TransactionType.ORDER);
  selectedOrderType = signal<OrderType>(OrderType.LTL);
  selectedFormat = signal<FormatType>(FormatType.EDI);
  selectedResponseType = signal<ResponseType>(ResponseType.ACK);

  selectedFile = signal<File | null>(null);
  isDragOver = signal(false);

  isProcessing = signal(false);
  
  // UPDATED: Changed from single result to array of results
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
    if (this.selectedTransactionType() === TransactionType.ORDER) {
      return this.orderResponseTypes;
    } else {
      return this.asnResponseTypes;
    }
  });

  // Computed: Show ORDER TYPE dropdown only when Transaction Type is ORDER
  showOrderType = computed(() => {
    return this.selectedTransactionType() === TransactionType.ORDER;
  });

  // Computed: Check if file input should be disabled (for GETSCHEMA)
  isFileInputDisabled = computed(() => {
    return this.selectedResponseType() === ResponseType.GETSCHEMA;
  });

  // Computed: Check if process button should be disabled
  isProcessDisabled = computed(() => {
    // If GETSCHEMA, don't need file - always enabled
    if (this.selectedResponseType() === ResponseType.GETSCHEMA) {
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
      const validResponseTypes = currentTransactionType === TransactionType.ORDER 
        ? this.orderResponseTypes 
        : this.asnResponseTypes;

      // If current response type is not valid for the new transaction type, reset to ACK
      if (!validResponseTypes.includes(currentResponseType)) {
        this.selectedResponseType.set(ResponseType.ACK);
      }
    }, { allowSignalWrites: true });
  }

  // Handle Transaction Type change
  onTransactionTypeChange(value: string): void {
    this.selectedTransactionType.set(value as TransactionType);
    // Reset ORDER TYPE to default when switching to ORDER
    if (value === TransactionType.ORDER) {
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

  // Clear file when switching to GETSCHEMA
  onResponseTypeChange(value: string): void {
    this.selectedResponseType.set(value as ResponseType);
    if (value === ResponseType.GETSCHEMA) {
      this.selectedFile.set(null);
    }
  }

  /**
   * Clear output state - resets error and results
   */
  private clearOutputState(): void {
    this.errorMessage.set(null);
    this.processedResults.set([]);  // UPDATED: Clear array
    this.isTimeoutError.set(false);
    this.currentUUID.set(null);
  }

  /**
   * Reset dashboard for next request
   * Called after timeout or successful processing
   */
  private resetForNextRequest(): void {
    this.isProcessing.set(false);
    // Cancel any pending request
    if (this.currentRequest) {
      this.currentRequest.unsubscribe();
      this.currentRequest = null;
    }
  }

  /**
   * Handle request error (including timeout)
   */
  private handleRequestError(error: any): void {
    console.error('Request error:', error);
    
    const uuid = this.currentUUID();
    const uuidSuffix = uuid ? ` (UUID=${uuid})` : '';
    
    if (error instanceof RequestTimeoutError) {
      this.errorMessage.set(`Request timed out. The server did not respond within 60 seconds. Please try again.${uuidSuffix}`);
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
    const isGetSchema = this.selectedResponseType() === ResponseType.GETSCHEMA;
    const file = this.selectedFile();
    
    // For non-GETSCHEMA, require file
    if (!isGetSchema && !file) return;

    // Cancel any existing request
    if (this.currentRequest) {
      this.currentRequest.unsubscribe();
      this.currentRequest = null;
    }

    this.isProcessing.set(true);
    this.clearOutputState();

    // Build form data for request
    const formData: DashboardFormData = {
      transactionType: this.selectedTransactionType(),
      format: this.selectedFormat(),
      responseType: this.selectedResponseType()
    };

    // Add ORDER TYPE only if Transaction Type is ORDER
    if (this.selectedTransactionType() === TransactionType.ORDER) {
      formData.orderType = this.selectedOrderType();
    }

    console.log('Starting request... Waiting for response (timeout: 60 seconds)');

    // Generate UUID and store it for error tracking
    const uuid = this.fileService.generateUUID();
    this.currentUUID.set(uuid);
    console.log('Request UUID:', uuid);

    if (isGetSchema) {
      // GETSCHEMA - no file needed
      // Using real backend method (switch to getSchemaSimulated for testing)
      this.currentRequest = this.fileService.getSchema(formData, uuid).subscribe({
        next: (response) => {
          console.log('Response received successfully:', response);
          // UPDATED: Extract array from response
          this.processedResults.set(response.response);
          this.resetForNextRequest();
        },
        error: (error) => {
          this.handleRequestError(error);
        }
      });
    } else {
      // File processing - includes Input File
      // Using real backend method (switch to processFileSimulated for testing)
      this.currentRequest = this.fileService.processFile(formData, file!, uuid).subscribe({
        next: (response) => {
          console.log('Response received successfully:', response);
          // UPDATED: Extract array from response
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

  logout(): void {
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
    if (this.currentRequest) {
      this.currentRequest.unsubscribe();
      this.currentRequest = null;
    }
  }
}
