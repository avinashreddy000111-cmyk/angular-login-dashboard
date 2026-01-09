import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth';
import { FileProcessingService, ProcessingResponse } from '../../services/file-processing';

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

  // Dropdown options
  transactionTypes = ['ORDER', 'ASN'];
  formats = ['EDI', 'JSON'];
  responseTypes = ['ACK', 'SHIPCONF', 'RECEIPT'];

  // Selected values
  selectedTransactionType = signal('ORDER');
  selectedFormat = signal('EDI');
  selectedResponseType = signal('ACK');

  // File handling
  selectedFile = signal<File | null>(null);
  isDragOver = signal(false);

  // Processing state
  isProcessing = signal(false);
  processedResult = signal<ProcessingResponse | null>(null);
  errorMessage = signal<string | null>(null);

  onDragOver(event: DragEvent): void {
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
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver.set(false);

    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      this.selectedFile.set(files[0]);
      // Clear previous results when new file is selected
      this.processedResult.set(null);
      this.errorMessage.set(null);
    }
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.selectedFile.set(input.files[0]);
      // Clear previous results when new file is selected
      this.processedResult.set(null);
      this.errorMessage.set(null);
    }
  }

  removeFile(): void {
    this.selectedFile.set(null);
    this.errorMessage.set(null);
  }

  processFile(): void {
    const file = this.selectedFile();
    if (!file) return;

    this.isProcessing.set(true);
    this.errorMessage.set(null);

    this.fileService.processFileSimulated(
      file,
      this.selectedTransactionType(),
      this.selectedFormat(),
      this.selectedResponseType()
    ).subscribe({
      next: (response: ProcessingResponse) => {
        this.processedResult.set(response);
        this.isProcessing.set(false);
        // Clear the input file after successful processing
        this.selectedFile.set(null);
      },
      error: (error: Error) => {
        this.errorMessage.set(error.message || 'Processing failed');
        this.isProcessing.set(false);
      }
    });
  }

  downloadResult(): void {
    const result = this.processedResult();
    if (!result) return;

    // Decode base64 content
    const byteCharacters = atob(result.content);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: result.mimeType });

    // Create download link
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = result.filename;
    link.click();
    window.URL.revokeObjectURL(url);

    // Clear the output after download
    this.processedResult.set(null);
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
