import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth';
import { FileProcessingService } from '../../services/file-processing';
import { 
  ProcessingResponse, 
  DashboardFormData,
  TransactionType,
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
export class DashboardComponent {
  private router = inject(Router);
  authService = inject(AuthService);
  private fileService = inject(FileProcessingService);

  // Enum references for template
  TransactionType = TransactionType;
  FormatType = FormatType;
  ResponseType = ResponseType;

  // Dropdown options
  transactionTypes = Object.values(TransactionType);
  formats = Object.values(FormatType);
  responseTypes = Object.values(ResponseType);

  // Selected values using enums
  selectedTransactionType = signal<TransactionType>(TransactionType.ORDER);
  selectedFormat = signal<FormatType>(FormatType.EDI);
  selectedResponseType = signal<ResponseType>(ResponseType.ACK);

  selectedFile = signal<File | null>(null);
  isDragOver = signal(false);

  isProcessing = signal(false);
  processedResult = signal<ProcessingResponse | null>(null);
  errorMessage = signal<string | null>(null);

  // Computed: Check if file input should be disabled
  isFileInputDisabled = computed(() => {
    return this.selectedResponseType() === ResponseType.GETSCHEMA;
  });

  // Computed: Check if process button should be disabled
  isProcessDisabled = computed(() => {
    // If GetSchema, don't need file - always enabled
    if (this.selectedResponseType() === ResponseType.GETSCHEMA) {
      return false;
    }
    // For other types, need a file
    return !this.selectedFile();
  });

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
      this.processedResult.set(null);
      this.errorMessage.set(null);
    }
  }

  onFileSelected(event: Event): void {
    if (this.isFileInputDisabled()) return;
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.selectedFile.set(input.files[0]);
      this.processedResult.set(null);
      this.errorMessage.set(null);
    }
  }

  removeFile(): void {
    this.selectedFile.set(null);
    this.errorMessage.set(null);
  }

  // Clear file when switching to GetSchema
  onResponseTypeChange(value: string): void {
    this.selectedResponseType.set(value as ResponseType);
    if (value === ResponseType.GETSCHEMA) {
      this.selectedFile.set(null);
    }
  }

  processFile(): void {
    const isGetSchema = this.selectedResponseType() === ResponseType.GETSCHEMA;
    const file = this.selectedFile();
    
    // For non-GetSchema, require file
    if (!isGetSchema && !file) return;

    this.isProcessing.set(true);
    this.errorMessage.set(null);

    const formData: DashboardFormData = {
      transactionType: this.selectedTransactionType(),
      format: this.selectedFormat(),
      responseType: this.selectedResponseType()
    };

    if (isGetSchema) {
      // GetSchema doesn't need a file
      this.fileService.getSchema(formData).subscribe({
        next: (response) => {
          this.processedResult.set(response);
          this.isProcessing.set(false);
        },
        error: (error) => {
          this.errorMessage.set(error.message || 'Failed to get schema');
          this.isProcessing.set(false);
        }
      });
    } else {
      // Normal file processing
      this.fileService.processFileSimulated(formData, file!).subscribe({
        next: (response) => {
          this.processedResult.set(response);
          this.isProcessing.set(false);
          this.selectedFile.set(null);
        },
        error: (error) => {
          this.errorMessage.set(error.message || 'Processing failed');
          this.isProcessing.set(false);
        }
      });
    }
  }

  downloadOutput(): void {
    const result = this.processedResult();
    if (!result) return;
    const byteCharacters = atob(result.content);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: result.mimeType });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = result.filename;
    link.click();
    window.URL.revokeObjectURL(url);
    this.processedResult.set(null);
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
