// src/app/services/file-processing.ts

import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, throwError, TimeoutError } from 'rxjs';
import { timeout, catchError } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { 
  ProcessingResponse,
  ProcessingResponseItem,
  DashboardFormData,
  BackendRequest,
  TransactionType,
  FormatType,
  ResponseType
} from '../models/interfaces';

// Custom error for timeout
export class RequestTimeoutError extends Error {
  constructor(message: string = 'Request timed out. Please try again.') {
    super(message);
    this.name = 'RequestTimeoutError';
  }
}

@Injectable({
  providedIn: 'root'
})
export class FileProcessingService {

  // Backend API URL - loaded from environment configuration
  private API_URL = environment.apiUrl;
  
  // Timeout duration in milliseconds (60 seconds)
  private readonly TIMEOUT_DURATION = 60000;

  private httpOptions = {
    headers: new HttpHeaders({
      'Content-Type': 'application/json'
    })
  };

  constructor(private http: HttpClient) {}

  /**
   * Generate a unique UUID for each transaction
   * Uses crypto.randomUUID() for true uniqueness across instances
   * Made public so dashboard can track the UUID
   */
  generateUUID(): string {
    // crypto.randomUUID() generates a proper UUID v4
    // Fallback for older browsers that don't support it
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    // Fallback UUID generation
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  /**
   * Build the JSON request object based on dashboard selections
   */
  private buildRequest(formData: DashboardFormData, uuid: string, fileContent?: string): BackendRequest {
    const request: BackendRequest = {
      UUID: uuid,
      Request: {
        'TRANSACTION TYPE': formData.transactionType,
        'FORMAT': formData.format,
        'RESPONSE TYPE': formData.responseType
      }
    };

    // Add ORDER TYPE only if Transaction Type is ORDER
    if (formData.transactionType === TransactionType.ORDER && formData.orderType) {
      request.Request['ORDER TYPE'] = formData.orderType;
    }

    // Only add Input File if content exists
    if (fileContent) {
      request.Request['Input File'] = fileContent;
    }

    return request;
  }

  /**
   * Handle timeout and other errors
   */
  private handleError(error: any): Observable<never> {
    if (error instanceof TimeoutError) {
      return throwError(() => new RequestTimeoutError());
    }
    
    // Re-throw other errors
    return throwError(() => error);
  }

  /**
   * Process file - sends JSON request to backend with 60-second timeout
   * Used when a file is uploaded (ACK, SHIPCONF, RECEIPT)
   * Response format: { response: ProcessingResponseItem[] }
   */
  processFile(formData: DashboardFormData, file: File, uuid: string): Observable<ProcessingResponse> {
    return new Observable(observer => {
      const reader = new FileReader();
      
      reader.onload = () => {
        // Get base64 content from file
        const base64Content = (reader.result as string).split(',')[1];
        
        // Build the request JSON
        const requestBody = this.buildRequest(formData, uuid, base64Content);
        
        // Log the request for debugging
        console.log('Sending request to backend:', JSON.stringify(requestBody, null, 2));
        console.log(`Request timeout set to ${this.TIMEOUT_DURATION / 1000} seconds`);
        
        // Send to backend with timeout
        this.http.post<ProcessingResponse>(this.API_URL, requestBody, this.httpOptions)
          .pipe(
            timeout(this.TIMEOUT_DURATION),
            catchError(this.handleError)
          )
          .subscribe({
            next: (response) => {
              observer.next(response);
              observer.complete();
            },
            error: (error) => {
              console.error('Backend error:', error);
              observer.error(error);
            }
          });
      };
      
      reader.onerror = () => {
        observer.error(new Error('Failed to read file'));
      };
      
      reader.readAsDataURL(file);
    });
  }

  /**
   * Get Schema - sends JSON request without file with 60-second timeout
   * Used when GETSCHEMA is selected
   * Response format: { response: ProcessingResponseItem[] }
   */
  getSchema(formData: DashboardFormData, uuid: string): Observable<ProcessingResponse> {
    // Build request without file content
    const requestBody = this.buildRequest(formData, uuid);
    
    // Log the request for debugging
    console.log('Sending schema request to backend:', JSON.stringify(requestBody, null, 2));
    console.log(`Request timeout set to ${this.TIMEOUT_DURATION / 1000} seconds`);
    
    // Send to backend with timeout
    return this.http.post<ProcessingResponse>(this.API_URL, requestBody, this.httpOptions)
      .pipe(
        timeout(this.TIMEOUT_DURATION),
        catchError(this.handleError)
      );
  }

  /**
   * SIMULATED VERSION - Use this for testing without backend
   * Process file with simulated response and 60-second timeout
   * Returns array format: { response: ProcessingResponseItem[] }
   */
  processFileSimulated(formData: DashboardFormData, file: File, uuid: string): Observable<ProcessingResponse> {
    return new Observable(observer => {
      const reader = new FileReader();
      const startTime = Date.now();
      
      reader.onload = () => {
        const base64Content = (reader.result as string).split(',')[1];
        
        // Build the request JSON (for logging/debugging)
        const requestBody = this.buildRequest(formData, uuid, base64Content);
        console.log('Request JSON (simulated):', JSON.stringify(requestBody, null, 2));
        console.log(`Request timeout set to ${this.TIMEOUT_DURATION / 1000} seconds`);
        
        // Simulate processing delay (1.5 seconds for normal response)
        // Change this value to test timeout (e.g., 65000 for timeout test)
        const simulatedDelay = 1500;
        
        const timeoutId = setTimeout(() => {
          const elapsedTime = Date.now() - startTime;
          
          // Check if we've exceeded the timeout
          if (elapsedTime >= this.TIMEOUT_DURATION) {
            observer.error(new RequestTimeoutError());
            return;
          }
          
          const response = this.generateSimulatedResponse(formData);
          observer.next(response);
          observer.complete();
        }, simulatedDelay);

        // Set up timeout check
        const timeoutCheckId = setTimeout(() => {
          clearTimeout(timeoutId);
          observer.error(new RequestTimeoutError());
        }, this.TIMEOUT_DURATION);

        // Clear the timeout check if we complete normally
        return () => {
          clearTimeout(timeoutId);
          clearTimeout(timeoutCheckId);
        };
      };
      
      reader.onerror = () => {
        observer.error(new Error('Failed to read file'));
      };
      
      reader.readAsDataURL(file);
    });
  }

  /**
   * SIMULATED VERSION - Get Schema without backend with 60-second timeout
   * Returns array format: { response: ProcessingResponseItem[] }
   */
  getSchemaSimulated(formData: DashboardFormData, uuid: string): Observable<ProcessingResponse> {
    // Build request without file content (for logging/debugging)
    const requestBody = this.buildRequest(formData, uuid);
    console.log('Schema Request JSON (simulated):', JSON.stringify(requestBody, null, 2));
    console.log(`Request timeout set to ${this.TIMEOUT_DURATION / 1000} seconds`);
    
    return new Observable(observer => {
      const startTime = Date.now();
      
      // Simulate processing delay (1 second for normal response)
      // Change this value to test timeout (e.g., 65000 for timeout test)
      const simulatedDelay = 1000;
      
      const timeoutId = setTimeout(() => {
        const elapsedTime = Date.now() - startTime;
        
        // Check if we've exceeded the timeout
        if (elapsedTime >= this.TIMEOUT_DURATION) {
          observer.error(new RequestTimeoutError());
          return;
        }
        
        const response = this.generateSchemaResponse(formData);
        observer.next(response);
        observer.complete();
      }, simulatedDelay);

      // Set up timeout check
      const timeoutCheckId = setTimeout(() => {
        clearTimeout(timeoutId);
        observer.error(new RequestTimeoutError());
      }, this.TIMEOUT_DURATION);

      // Return cleanup function
      return () => {
        clearTimeout(timeoutId);
        clearTimeout(timeoutCheckId);
      };
    });
  }

  // ============ SIMULATED RESPONSE GENERATORS ============
  // Now returns { response: ProcessingResponseItem[] } format

  private generateSimulatedResponse(formData: DashboardFormData): ProcessingResponse {
    const timestamp = Date.now().toString();
    const orderType = formData.orderType || 'DEFAULT';
    const extension = formData.format === FormatType.EDI ? 'edi' : 'json';
    
    // Generate multiple files based on response type
    const files: ProcessingResponseItem[] = [];

    if (formData.responseType === ResponseType.ACK) {
      // ACK response - return ACK file
      files.push({
        success: true,
        filename: `${formData.transactionType}_${orderType}_ACK_${timestamp}.${extension}`,
        content: formData.format === FormatType.EDI 
          ? btoa(this.generateEdiContent(formData, 'ACK'))
          : btoa(this.generateJsonContent(formData, 'ACK')),
        mimeType: formData.format === FormatType.EDI ? 'application/edi-x12' : 'application/json',
        message: 'ACK file processed successfully'
      });
    } else if (formData.responseType === ResponseType.SHIPCONFIRM) {
      // SHIPCONFIRM response - return ACK and SHIPCONFIRM files
      files.push({
        success: true,
        filename: `${formData.transactionType}_${orderType}_ACK_${timestamp}.${extension}`,
        content: formData.format === FormatType.EDI 
          ? btoa(this.generateEdiContent(formData, 'ACK'))
          : btoa(this.generateJsonContent(formData, 'ACK')),
        mimeType: formData.format === FormatType.EDI ? 'application/edi-x12' : 'application/json',
        message: 'ACK file processed successfully'
      });
      files.push({
        success: true,
        filename: `${formData.transactionType}_${orderType}_SHIPCONFIRM_${timestamp}.${extension}`,
        content: formData.format === FormatType.EDI 
          ? btoa(this.generateEdiContent(formData, 'SHIPCONF'))
          : btoa(this.generateJsonContent(formData, 'SHIPCONF')),
        mimeType: formData.format === FormatType.EDI ? 'application/edi-x12' : 'application/json',
        message: 'SHIPCONFIRM file processed successfully'
      });
    } else if (formData.responseType === ResponseType.RECEIPT) {
      // RECEIPT response - return ACK and RECEIPT files
      files.push({
        success: true,
        filename: `${formData.transactionType}_ACK_${timestamp}.${extension}`,
        content: formData.format === FormatType.EDI 
          ? btoa(this.generateEdiContent(formData, 'ACK'))
          : btoa(this.generateJsonContent(formData, 'ACK')),
        mimeType: formData.format === FormatType.EDI ? 'application/edi-x12' : 'application/json',
        message: 'ACK file processed successfully'
      });
      files.push({
        success: true,
        filename: `${formData.transactionType}_RECEIPT_${timestamp}.${extension}`,
        content: formData.format === FormatType.EDI 
          ? btoa(this.generateEdiContent(formData, 'RECEIPT'))
          : btoa(this.generateJsonContent(formData, 'RECEIPT')),
        mimeType: formData.format === FormatType.EDI ? 'application/edi-x12' : 'application/json',
        message: 'RECEIPT file processed successfully'
      });
    }

    return { response: files };
  }

  private generateSchemaResponse(formData: DashboardFormData): ProcessingResponse {
    const timestamp = Date.now().toString();
    const extension = formData.format === FormatType.EDI ? 'txt' : 'json';
    
    const files: ProcessingResponseItem[] = [{
      success: true,
      filename: `schema_${formData.transactionType}_${formData.format}_${timestamp}.${extension}`,
      content: formData.format === FormatType.EDI 
        ? btoa(this.generateEdiSchema(formData))
        : btoa(this.generateJsonSchema(formData)),
      mimeType: formData.format === FormatType.EDI ? 'text/plain' : 'application/json',
      message: 'Schema generated successfully'
    }];

    return { response: files };
  }

  private generateEdiContent(formData: DashboardFormData, type: string): string {
    const timestamp = new Date().toISOString().replace(/[-:T]/g, '').substring(0, 14);
    const controlNumber = Date.now().toString().substring(0, 9);
    
    return `ISA*00*          *00*          *ZZ*SENDER         *ZZ*RECEIVER       *${timestamp.substring(2, 8)}*${timestamp.substring(8, 12)}*U*00401*${controlNumber}*0*P*>~
GS*PR*SENDER*RECEIVER*${timestamp.substring(0, 8)}*${timestamp.substring(8, 12)}*${controlNumber.substring(0, 6)}*X*004010~
ST*855*0001~
BAK*00*AC*${timestamp.substring(0, 8)}*PO-${Date.now() % 100000}~
DTM*002*${timestamp.substring(0, 8)}~
MSG*${type} for ${formData.transactionType}~
SE*6*0001~
GE*1*${controlNumber.substring(0, 6)}~
IEA*1*${controlNumber}~`;
  }

  private generateJsonContent(formData: DashboardFormData, type: string): string {
    const response: any = {
      header: {
        messageType: type,
        transactionType: formData.transactionType,
        timestamp: new Date().toISOString(),
        version: "0.0.2"
      },
      response: {
        status: "SUCCESS",
        message: `${type} processed successfully`
      }
    };

    // Add orderType if present
    if (formData.orderType) {
      response.header.orderType = formData.orderType;
    }

    return JSON.stringify(response, null, 2);
  }

  private generateEdiSchema(formData: DashboardFormData): string {
    let schema = `EDI Schema for ${formData.transactionType}
========================================
Format: EDI X12 004010
Transaction Type: ${formData.transactionType}
`;

    if (formData.orderType) {
      schema += `Order Type: ${formData.orderType}
`;
    }

    schema += `
Segments: ISA, GS, ST, SE, GE, IEA
`;
    return schema;
  }

  private generateJsonSchema(formData: DashboardFormData): string {
    const schema: any = {
      "$schema": "http://json-schema.org/draft-07/schema#",
      "title": `${formData.transactionType} Schema`,
      "type": "object",
      "properties": {
        "transactionType": { "type": "string", "enum": [formData.transactionType] },
        "format": { "type": "string", "enum": [formData.format] }
      }
    };

    // Add orderType to schema if present
    if (formData.orderType) {
      schema.properties.orderType = { "type": "string", "enum": [formData.orderType] };
    }

    return JSON.stringify(schema, null, 2);
  }
}
