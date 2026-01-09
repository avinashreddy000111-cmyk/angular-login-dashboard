// src/app/services/file-processing.ts

import { Injectable, signal, computed } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map, timeout, retry } from 'rxjs/operators';
import {
  ProcessingRequest,
  ProcessingResponse,
  DashboardFormData,
  FormatType
} from '../models/interfaces';

@Injectable({
  providedIn: 'root'
})
export class FileProcessingService {
  // Configure your backend API URL here
  private readonly API_URL = 'https://api.example.com/process';
  private readonly REQUEST_TIMEOUT = 30000;
  private readonly MAX_RETRIES = 2;

  // State signals
  private isLoadingSignal = signal<boolean>(false);
  private errorSignal = signal<string | null>(null);
  private outputFileSignal = signal<ProcessingResponse | null>(null);

  // Public computed signals
  readonly isLoading = computed(() => this.isLoadingSignal());
  readonly error = computed(() => this.errorSignal());
  readonly outputFile = computed(() => this.outputFileSignal());

  constructor(private http: HttpClient) {}

  /**
   * Processes the uploaded file with the selected options (for real backend)
   */
  processFile(formData: DashboardFormData, file: File): Observable<ProcessingResponse> {
    this.isLoadingSignal.set(true);
    this.errorSignal.set(null);

    return new Observable<ProcessingResponse>(observer => {
      this.readFileAsBase64(file)
        .then(base64Content => {
          const request = this.constructRequest(formData, file, base64Content);
          
          this.sendRequest(request).subscribe({
            next: (response: ProcessingResponse) => {
              this.outputFileSignal.set(response);
              this.isLoadingSignal.set(false);
              observer.next(response);
              observer.complete();
            },
            error: (err: Error) => {
              this.isLoadingSignal.set(false);
              this.errorSignal.set(err.message || 'An error occurred during processing');
              observer.error(err);
            }
          });
        })
        .catch(err => {
          this.isLoadingSignal.set(false);
          this.errorSignal.set('Failed to read file: ' + err.message);
          observer.error(new Error('Failed to read file: ' + err.message));
        });
    });
  }

  /**
   * Simulates backend processing for testing without a real backend
   */
  processFileSimulated(formData: DashboardFormData, file: File): Observable<ProcessingResponse> {
    this.isLoadingSignal.set(true);
    this.errorSignal.set(null);

    return new Observable<ProcessingResponse>(observer => {
      this.readFileAsBase64(file)
        .then(base64Content => {
          // Simulate API delay
          setTimeout(() => {
            const simulatedResponse: ProcessingResponse = {
              success: true,
              filename: `processed_${formData.responseType}_${Date.now()}.${this.getFileExtension(formData.format)}`,
              content: base64Content,
              mimeType: this.getMimeType(formData.format),
              message: `Successfully processed ${file.name} as ${formData.transactionType} in ${formData.format} format`
            };

            this.outputFileSignal.set(simulatedResponse);
            this.isLoadingSignal.set(false);
            observer.next(simulatedResponse);
            observer.complete();
          }, 1500);
        })
        .catch(err => {
          this.isLoadingSignal.set(false);
          this.errorSignal.set('Failed to read file: ' + err.message);
          observer.error(new Error('Failed to read file: ' + err.message));
        });
    });
  }

  /**
   * Downloads the processed file
   */
  downloadFile(response: ProcessingResponse): void {
    try {
      const binaryString = atob(response.content);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      const blob = new Blob([bytes], { type: response.mimeType });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = response.filename;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      this.errorSignal.set('Failed to download file');
      console.error('Download error:', err);
    }
  }

  /**
   * Clears the current output file
   */
  clearOutput(): void {
    this.outputFileSignal.set(null);
    this.errorSignal.set(null);
  }

  /**
   * Clears any error messages
   */
  clearError(): void {
    this.errorSignal.set(null);
  }

  /**
   * Sets an error message
   */
  setError(message: string): void {
    this.errorSignal.set(message);
  }

  private readFileAsBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = () => {
        try {
          const result = reader.result as string;
          const base64 = result.split(',')[1] || result;
          resolve(base64);
        } catch (err) {
          reject(new Error('Failed to encode file content'));
        }
      };
      
      reader.onerror = () => {
        reject(new Error('Failed to read file'));
      };
      
      reader.readAsDataURL(file);
    });
  }

  private constructRequest(
    formData: DashboardFormData,
    file: File,
    base64Content: string
  ): ProcessingRequest {
    return {
      metadata: {
        transactionType: formData.transactionType,
        format: formData.format,
        responseType: formData.responseType,
        timestamp: new Date().toISOString()
      },
      fileData: {
        fileName: file.name,
        content: base64Content,
        mimeType: file.type || 'application/octet-stream'
      }
    };
  }

  private sendRequest(request: ProcessingRequest): Observable<ProcessingResponse> {
    return this.http.post<ProcessingResponse>(this.API_URL, request).pipe(
      timeout(this.REQUEST_TIMEOUT),
      retry(this.MAX_RETRIES),
      map((response: ProcessingResponse) => {
        if (!response.success) {
          throw new Error(response.message || 'Processing failed');
        }
        return response;
      }),
      catchError((error: HttpErrorResponse) => this.handleError(error))
    );
  }

  private handleError(error: HttpErrorResponse): Observable<never> {
    let errorMessage: string;

    if (error.error instanceof ErrorEvent) {
      errorMessage = `Network error: ${error.error.message}`;
    } else if (error.status === 0) {
      errorMessage = 'Unable to connect to the server. Please check your internet connection.';
    } else if (error.status === 401) {
      errorMessage = 'Authentication failed. Please log in again.';
    } else if (error.status === 403) {
      errorMessage = 'You do not have permission to perform this action.';
    } else if (error.status === 404) {
      errorMessage = 'The requested resource was not found.';
    } else if (error.status === 413) {
      errorMessage = 'The uploaded file is too large.';
    } else if (error.status === 500) {
      errorMessage = 'Server error. Please try again later.';
    } else if (error.status === 503) {
      errorMessage = 'Service temporarily unavailable. Please try again later.';
    } else {
      errorMessage = error.error?.message || `Error: ${error.status} - ${error.statusText}`;
    }

    return throwError(() => new Error(errorMessage));
  }

  private getFileExtension(format: FormatType): string {
    switch (format) {
      case FormatType.EDI:
        return 'edi';
      case FormatType.JSON:
        return 'json';
      default:
        return 'txt';
    }
  }

  private getMimeType(format: FormatType): string {
    switch (format) {
      case FormatType.EDI:
        return 'application/edi-x12';
      case FormatType.JSON:
        return 'application/json';
      default:
        return 'text/plain';
    }
  }
}
