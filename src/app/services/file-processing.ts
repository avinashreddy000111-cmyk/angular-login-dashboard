import { Injectable } from '@angular/core';
import { Observable, of, delay } from 'rxjs';
import { 
  ProcessingResponse, 
  DashboardFormData,
  TransactionType,
  FormatType,
  ResponseType
} from '../models/interfaces';

@Injectable({
  providedIn: 'root'
})
export class FileProcessingService {

  // For real backend, use:
  // private API_URL = 'http://localhost:8080/api/process';
  // private SCHEMA_URL = 'http://localhost:8080/api/schema';

  constructor() {}

  /**
   * Process file with form data (simulated)
   */
  processFileSimulated(formData: DashboardFormData, file: File): Observable<ProcessingResponse> {
    return new Observable(observer => {
      const reader = new FileReader();
      
      reader.onload = () => {
        const base64Content = (reader.result as string).split(',')[1] || btoa(reader.result as string);
        
        // Simulate processing delay
        setTimeout(() => {
          const response = this.generateResponse(formData, file.name, base64Content);
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
   * Get schema (no file required)
   */
  getSchema(formData: DashboardFormData): Observable<ProcessingResponse> {
    return new Observable(observer => {
      // Simulate API call delay
      setTimeout(() => {
        const schema = this.generateSchema(formData);
        observer.next(schema);
        observer.complete();
      }, 1000);
    });
  }

  private generateResponse(formData: DashboardFormData, fileName: string, content: string): ProcessingResponse {
    const timestamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0];
    
    let outputContent: string;
    let mimeType: string;
    let extension: string;

    if (formData.format === FormatType.EDI) {
      outputContent = this.generateEdiResponse(formData);
      mimeType = 'application/edi-x12';
      extension = 'edi';
    } else {
      outputContent = this.generateJsonResponse(formData);
      mimeType = 'application/json';
      extension = 'json';
    }

    return {
      success: true,
      filename: `processed_${formData.responseType}_${timestamp}.${extension}`,
      content: btoa(outputContent),
      mimeType: mimeType,
      message: 'File processed successfully'
    };
  }

  private generateSchema(formData: DashboardFormData): ProcessingResponse {
    const timestamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0];
    
    let schemaContent: string;
    let mimeType: string;
    let extension: string;

    if (formData.format === FormatType.EDI) {
      schemaContent = this.generateEdiSchema(formData);
      mimeType = 'text/plain';
      extension = 'txt';
    } else {
      schemaContent = this.generateJsonSchema(formData);
      mimeType = 'application/json';
      extension = 'json';
    }

    return {
      success: true,
      filename: `schema_${formData.transactionType}_${formData.format}_${timestamp}.${extension}`,
      content: btoa(schemaContent),
      mimeType: mimeType,
      message: 'Schema generated successfully'
    };
  }

  private generateEdiSchema(formData: DashboardFormData): string {
    const transactionType = formData.transactionType;
    
    if (transactionType === TransactionType.ORDER) {
      return `EDI 850 Purchase Order Schema
========================================
Transaction Type: ORDER
Format: EDI X12 004010

Segment Structure:
------------------
ISA - Interchange Control Header (Required)
  ISA01: Authorization Information Qualifier (2 chars)
  ISA02: Authorization Information (10 chars)
  ISA03: Security Information Qualifier (2 chars)
  ISA04: Security Information (10 chars)
  ISA05: Interchange ID Qualifier (2 chars)
  ISA06: Interchange Sender ID (15 chars)
  ISA07: Interchange ID Qualifier (2 chars)
  ISA08: Interchange Receiver ID (15 chars)
  ISA09: Interchange Date (6 chars, YYMMDD)
  ISA10: Interchange Time (4 chars, HHMM)
  ISA11: Repetition Separator (1 char)
  ISA12: Interchange Control Version (5 chars)
  ISA13: Interchange Control Number (9 chars)
  ISA14: Acknowledgment Requested (1 char)
  ISA15: Usage Indicator (1 char)
  ISA16: Component Element Separator (1 char)

GS - Functional Group Header (Required)
ST - Transaction Set Header (Required)
BEG - Beginning Segment for Purchase Order (Required)
DTM - Date/Time Reference (Optional)
N1 - Name (Optional, Loop)
PO1 - Purchase Order Line Item (Required, Loop)
SE - Transaction Set Trailer (Required)
GE - Functional Group Trailer (Required)
IEA - Interchange Control Trailer (Required)
`;
    } else {
      return `EDI 856 Advance Ship Notice Schema
========================================
Transaction Type: ASN
Format: EDI X12 004010

Segment Structure:
------------------
ISA - Interchange Control Header (Required)
GS - Functional Group Header (Required)
ST - Transaction Set Header (Required)
BSN - Beginning Segment for Ship Notice (Required)
  BSN01: Transaction Set Purpose Code (2 chars)
  BSN02: Shipment Identification (30 chars)
  BSN03: Date (8 chars, CCYYMMDD)
  BSN04: Time (4-8 chars)
DTM - Date/Time Reference (Optional)
HL - Hierarchical Level (Required, Loop)
  HL01: Hierarchical ID Number
  HL02: Hierarchical Parent ID Number
  HL03: Hierarchical Level Code (S=Shipment, O=Order, I=Item)
TD1 - Carrier Details (Quantity and Weight) (Optional)
TD5 - Carrier Details (Routing Sequence/Transit Time) (Optional)
REF - Reference Identification (Optional)
N1 - Name (Optional)
LIN - Item Identification (Optional)
SN1 - Item Detail (Shipment) (Optional)
SE - Transaction Set Trailer (Required)
GE - Functional Group Trailer (Required)
IEA - Interchange Control Trailer (Required)
`;
    }
  }

  private generateJsonSchema(formData: DashboardFormData): string {
    const transactionType = formData.transactionType;
    
    if (transactionType === TransactionType.ORDER) {
      return JSON.stringify({
        "$schema": "http://json-schema.org/draft-07/schema#",
        "title": "Purchase Order Schema",
        "type": "object",
        "required": ["header", "order"],
        "properties": {
          "header": {
            "type": "object",
            "required": ["transactionType", "format", "timestamp"],
            "properties": {
              "transactionType": {
                "type": "string",
                "enum": ["ORDER"]
              },
              "format": {
                "type": "string",
                "enum": ["JSON"]
              },
              "timestamp": {
                "type": "string",
                "format": "date-time"
              },
              "version": {
                "type": "string"
              }
            }
          },
          "order": {
            "type": "object",
            "required": ["orderId", "buyer", "items"],
            "properties": {
              "orderId": {
                "type": "string",
                "description": "Unique order identifier"
              },
              "orderDate": {
                "type": "string",
                "format": "date"
              },
              "buyer": {
                "type": "object",
                "properties": {
                  "id": { "type": "string" },
                  "name": { "type": "string" },
                  "address": { "type": "string" }
                }
              },
              "seller": {
                "type": "object",
                "properties": {
                  "id": { "type": "string" },
                  "name": { "type": "string" }
                }
              },
              "items": {
                "type": "array",
                "items": {
                  "type": "object",
                  "required": ["itemId", "quantity"],
                  "properties": {
                    "lineNumber": { "type": "integer" },
                    "itemId": { "type": "string" },
                    "description": { "type": "string" },
                    "quantity": { "type": "number" },
                    "unitPrice": { "type": "number" },
                    "unit": { "type": "string" }
                  }
                }
              },
              "totalAmount": {
                "type": "number"
              }
            }
          }
        }
      }, null, 2);
    } else {
      return JSON.stringify({
        "$schema": "http://json-schema.org/draft-07/schema#",
        "title": "Advance Ship Notice Schema",
        "type": "object",
        "required": ["header", "shipment"],
        "properties": {
          "header": {
            "type": "object",
            "required": ["transactionType", "format", "timestamp"],
            "properties": {
              "transactionType": {
                "type": "string",
                "enum": ["ASN"]
              },
              "format": {
                "type": "string",
                "enum": ["JSON"]
              },
              "timestamp": {
                "type": "string",
                "format": "date-time"
              }
            }
          },
          "shipment": {
            "type": "object",
            "required": ["shipmentId", "shipDate"],
            "properties": {
              "shipmentId": {
                "type": "string"
              },
              "shipDate": {
                "type": "string",
                "format": "date"
              },
              "estimatedDelivery": {
                "type": "string",
                "format": "date"
              },
              "carrier": {
                "type": "object",
                "properties": {
                  "name": { "type": "string" },
                  "trackingNumber": { "type": "string" }
                }
              },
              "shipFrom": {
                "type": "object",
                "properties": {
                  "name": { "type": "string" },
                  "address": { "type": "string" }
                }
              },
              "shipTo": {
                "type": "object",
                "properties": {
                  "name": { "type": "string" },
                  "address": { "type": "string" }
                }
              },
              "items": {
                "type": "array",
                "items": {
                  "type": "object",
                  "properties": {
                    "itemId": { "type": "string" },
                    "quantity": { "type": "number" },
                    "weight": { "type": "number" }
                  }
                }
              }
            }
          }
        }
      }, null, 2);
    }
  }

  private generateEdiResponse(formData: DashboardFormData): string {
    const timestamp = new Date().toISOString().replace(/[-:T]/g, '').substring(0, 14);
    const controlNumber = Date.now().toString().substring(0, 9);
    
    return `ISA*00*          *00*          *ZZ*SENDER         *ZZ*RECEIVER       *${timestamp.substring(2, 8)}*${timestamp.substring(8, 12)}*U*00401*${controlNumber}*0*P*>~
GS*PR*SENDER*RECEIVER*${timestamp.substring(0, 8)}*${timestamp.substring(8, 12)}*${controlNumber.substring(0, 6)}*X*004010~
ST*855*0001~
BAK*00*AC*${timestamp.substring(0, 8)}*PO-${Date.now() % 100000}~
DTM*002*${timestamp.substring(0, 8)}~
N1*ST*SHIP TO LOCATION*92*LOC001~
N1*BY*BUYER NAME*92*BUY001~
PO1*1*10*EA*25.00**IN*ITEM001*VN*VENDOR001~
ACK*IA*10*EA*068*${timestamp.substring(0, 8)}~
SE*9*0001~
GE*1*${controlNumber.substring(0, 6)}~
IEA*1*${controlNumber}~`;
  }

  private generateJsonResponse(formData: DashboardFormData): string {
    return JSON.stringify({
      header: {
        messageType: formData.responseType,
        transactionType: formData.transactionType,
        timestamp: new Date().toISOString(),
        version: "0.0.2"
      },
      response: {
        acknowledgmentCode: "AC",
        status: "ACCEPTED",
        message: "Transaction processed successfully"
      }
    }, null, 2);
  }
}
