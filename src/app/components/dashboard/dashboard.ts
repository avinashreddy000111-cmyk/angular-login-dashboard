// src/app/components/dashboard/dashboard.ts

import { Component, OnInit, OnDestroy, signal, inject, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  Validators,
  ReactiveFormsModule
} from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { AuthService } from '../../services/auth';
import { FileProcessingService } from '../../services/file-processing';
import {
  TransactionType,
  FormatType,
  ResponseType,
  DropdownOption,
  ProcessingResponse
} from '../../models/interfaces';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './dashboard.html',
  styleUrls: ['./dashboard.scss']
})
export class DashboardComponent implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  authService = inject(AuthService);
  fileService = inject(FileProcessingService);

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  dashboardForm!: FormGroup;
  selectedFile = signal<File | null>(null);
  isDragging = signal<boolean>(false);

  transactionTypes: DropdownOption[] = [
    { value: TransactionType.ORDER, label: 'ORDER' },
    { value: TransactionType.ASN, label: 'ASN' }
  ];

  formatTypes: DropdownOption[] = [
    { value: FormatType.EDI, label: 'EDI' },
    { value: FormatType.JSON, label: 'JSON' }
  ];

  responseTypes: DropdownOption[] = [
    { value: ResponseType.ACK, label: 'ACK' },
    { value: ResponseType.SHIPCONF, label: 'SHIPCONF' },
    { value: ResponseType.RECEIPT, label: 'RECEIPT' }
  ];

  private allowedFileTypes = [
    'text/plain',
    'application/json',
    'text/xml',
    'application/xml',
    'text/csv',
    'application/x-x12',
    'application/edi-x12',
    'application/octet-stream'
  ];

  private maxFileSize = 10 * 1024 * 1024; // 10MB
  private destroy$ = new Subject<void>();

  ngOnInit(): void {
    this.initializeForm();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initializeForm(): void {
    this.dashboardForm = this.fb.group({
      transactionType: [TransactionType.ORDER, Validators.required],
      format: [FormatType.EDI, Validators.required],
      responseType: [ResponseType.ACK, Validators.required]
    });
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.processSelectedFile(input.files[0]);
    }
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(true);
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(false);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(false);

    if (event.dataTransfer?.files && event.dataTransfer.files.length > 0) {
      this.processSelectedFile(event.dataTransfer.files[0]);
    }
  }

  private processSelectedFile(file: File): void {
    this.fileService.clearError();

    if (!this.isValidFileType(file)) {
      this.fileService.setError(
        'Invalid file type. Please upload a text, JSON, XML, or EDI file.'
      );
      return;
    }

    if (file.size > this.maxFileSize) {
      this.fileService.setError(
        `File is too large. Maximum size is ${this.formatFileSize(this.maxFileSize)}.`
      );
      return;
    }

    this.selectedFile.set(file);
  }

  private isValidFileType(file: File): boolean {
    if (this.allowedFileTypes.includes(file.type)) {
      return true;
    }

    const extension = file.name.split('.').pop()?.toLowerCase();
    const validExtensions = ['txt', 'json', 'xml', 'csv', 'edi', 'x12'];
    return validExtensions.includes(extension || '');
  }

  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  triggerFileInput(): void {
    this.fileInput?.nativeElement?.click();
  }

  removeFile(): void {
    this.selectedFile.set(null);
    if (this.fileInput?.nativeElement) {
      this.fileInput.nativeElement.value = '';
    }
    this.fileService.clearError();
  }

  onSubmit(): void {
    if (this.dashboardForm.invalid) {
      this.fileService.setError('Please fill in all required fields.');
      return;
    }

    const file = this.selectedFile();
    if (!file) {
      this.fileService.setError('Please upload a file to process.');
      return;
    }

    const formData = {
      transactionType: this.dashboardForm.get('transactionType')?.value,
      format: this.dashboardForm.get('format')?.value,
      responseType: this.dashboardForm.get('responseType')?.value
    };

    this.fileService.processFileSimulated(formData, file)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: ProcessingResponse) => {
          console.log('Processing successful:', response);
        },
        error: (error: Error) => {
          console.error('Processing failed:', error);
        }
      });
  }

  downloadOutput(): void {
    const output = this.fileService.outputFile();
    if (output) {
      this.fileService.downloadFile(output);
    }
  }

  clearOutput(): void {
    this.fileService.clearOutput();
  }

  logout(): void {
    this.authService.logout();
  }
}
