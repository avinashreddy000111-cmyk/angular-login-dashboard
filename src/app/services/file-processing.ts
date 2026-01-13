import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { 
  ProcessingResponse, 
  DashboardFormData,
  BackendRequest,
  TransactionType,
  FormatType,
  ResponseType
} from '../models/interfaces';

@Injectable({
  providedIn: 'root'
})
export class FileProcessingService {

  // Backend API URL - Update this when deploying
  private API_URL = 'http://localhost:8080/api/process';
  
  // For production (Render deployment):
  // private API_URL = 'https://your-backend.onrender.com/api/process';

  private httpOptions = {
    headers: new HttpHeaders({
      'Content-Type': 'application/json'
    })
  };

  constructor(private http: HttpClient) {}

  /**
   * Build the JSON request object based on dashboard selections
   * 
   * Output format:
   * {
   *   "Request": {
   *     "TRANSACTION TYPE": "ORDER",
   *     "FORMAT": "EDI",
   *     "RESPONSE TYPE": "ACK",
   *     "Input File": "base64_content" (optional)
   *   }
   * }
   */
  private buildRequest(formData: DashboardFormData, fileContent?: string): BackendRequest {
    const request: BackendRequest = {
      Request: {
        'TRANSACTION_TYPE': formData.transactionType,
        'FORMAT': formData.format,
        'RESPONSE_TYPE': formData.responseType
      }
    };

    // Only add Input File if content exists
    if (fileContent) {
      request.Request['Input_File'] = fileContent;
    }

    return request;
  }

  /**
   * Process file - sends JSON request to backend
   * Used when a file is uploaded (ACK, SHIPCONF, RECEIPT)
   */
  processFile(formData: DashboardFormData, file: File): Observable<ProcessingResponse> {
    return new Observable(observer => {
      const reader = new FileReader();
      
      reader.onload = () => {
        // Get base64 content from file
        const base64Content = (reader.result as string).split(',')[1];
        
        // Build the request JSON
        const requestBody = this.buildRequest(formData, base64Content);
        
        // Log the request for debugging
        console.log('Sending request to backend:', JSON.stringify(requestBody, null, 2));
        
        // Send to backend
        this.http.post<ProcessingResponse>(this.API_URL, requestBody, this.httpOptions)
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
        observer.error({ message: 'Failed to read file' });
      };
      
      reader.readAsDataURL(file);
    });
  }

  /**
   * Get Schema - sends JSON request without file
   * Used when GETSCHEMA is selected
   */
  getSchema(formData: DashboardFormData): Observable<ProcessingResponse> {
    // Build request without file content
    const requestBody = this.buildRequest(formData);
    
    // Log the request for debugging
    console.log('Sending schema request to backend:', JSON.stringify(requestBody, null, 2));
    
    // Send to backend
    return this.http.post<ProcessingResponse>(this.API_URL, requestBody, this.httpOptions);
  }

  /**
   * SIMULATED VERSION - Use this for testing without backend
   * Process file with simulated response
   */
  processFileSimulated(formData: DashboardFormData, file: File): Observable<ProcessingResponse> {
    return new Observable(observer => {
      const reader = new FileReader();
      
      reader.onload = () => {
        const base64Content = (reader.result as string).split(',')[1];
        
        // Build the request JSON (for logging/debugging)
        const requestBody = this.buildRequest(formData, base64Content);
        console.log('Request JSON (simulated):', JSON.stringify(requestBody, null, 2));
        
        // Simulate processing delay
        setTimeout(() => {
          const response = this.generateSimulatedResponse(formData);
          observer.next(response);
          observer.complete();
        }, 1500);
      };
      
      reader.onerror = () => {
        observer.error({ message: 'Failed to read file' });
      };
      
      reader.readAsDataURL(file);
    });
  }

  /**
   * SIMULATED VERSION - Get Schema without backend
   */
  getSchemaSimulated(formData: DashboardFormData): Observable<ProcessingResponse> {
    // Build request without file content (for logging/debugging)
    const requestBody = this.buildRequest(formData);
    console.log('Schema Request JSON (simulated):', JSON.stringify(requestBody, null, 2));
    
    return new Observable(observer => {
      setTimeout(() => {
        const response = this.generateSchemaResponse(formData);
        observer.next(response);
        observer.complete();
      }, 1000);
    });
  }

  // ============ SIMULATED RESPONSE GENERATORS ============

  private generateSimulatedResponse(formData: DashboardFormData): ProcessingResponse {
    const timestamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0];
    const extension = formData.format === FormatType.EDI ? 'edi' : 'json';
    
    let content: string;
    if (formData.format === FormatType.EDI) {
      content = this.generateEdiContent(formData);
    } else {
      content = this.generateJsonContent(formData);
    }

    return {
      success: true,
      filename: `processed_${formData.responseType}_${timestamp}.${extension}`,
      content: btoa(content),
      mimeType: formData.format === FormatType.EDI ? 'application/edi-x12' : 'application/json',
      message: 'File processed successfully'
    };
  }

  private generateSchemaResponse(formData: DashboardFormData): ProcessingResponse {
    const timestamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0];
    const extension = formData.format === FormatType.EDI ? 'txt' : 'json';
    
    let content: string;
    if (formData.format === FormatType.EDI) {
      content = this.generateEdiSchema(formData);
    } else {
      content = this.generateJsonSchema(formData);
    }

    return {
      success: true,
      filename: `schema_${formData.transactionType}_${formData.format}_${timestamp}.${extension}`,
      content: btoa(content),
      mimeType: formData.format === FormatType.EDI ? 'text/plain' : 'application/json',
      message: 'Schema generated successfully'
    };
  }

  private generateEdiContent(formData: DashboardFormData): string {
    const timestamp = new Date().toISOString().replace(/[-:T]/g, '').substring(0, 14);
    const controlNumber = Date.now().toString().substring(0, 9);
    
    return `ISA*00*          *00*          *ZZ*SENDER         *ZZ*RECEIVER       *${timestamp.substring(2, 8)}*${timestamp.substring(8, 12)}*U*00401*${controlNumber}*0*P*>~
GS*PR*SENDER*RECEIVER*${timestamp.substring(0, 8)}*${timestamp.substring(8, 12)}*${controlNumber.substring(0, 6)}*X*004010~
ST*855*0001~
BAK*00*AC*${timestamp.substring(0, 8)}*PO-${Date.now() % 100000}~
DTM*002*${timestamp.substring(0, 8)}~
SE*5*0001~
GE*1*${controlNumber.substring(0, 6)}~
IEA*1*${controlNumber}~`;
  }

  private generateJsonContent(formData: DashboardFormData): string {
    return JSON.stringify({
      header: {
        messageType: formData.responseType,
        transactionType: formData.transactionType,
        timestamp: new Date().toISOString(),
        version: "0.0.2"
      },
      response: {
        status: "SUCCESS",
        message: "Transaction processed successfully"
      }
    }, null, 2);
  }

  private generateEdiSchema(formData: DashboardFormData): string {
    return `EDI Schema for ${formData.transactionType}
========================================
Format: EDI X12 004010
Transaction Type: ${formData.transactionType}

Segments: ISA, GS, ST, SE, GE, IEA
`;
  }

  private generateJsonSchema(formData: DashboardFormData): string {
    return JSON.stringify({
      "$schema": "http://json-schema.org/draft-07/schema#",
      "title": `${formData.transactionType} Schema`,
      "type": "object",
      "properties": {
        "transactionType": { "type": "string", "enum": [formData.transactionType] },
        "format": { "type": "string", "enum": [formData.format] }
      }
    }, null, 2);
  }
}
