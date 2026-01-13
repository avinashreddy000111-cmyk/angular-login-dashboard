// src/app/models/interfaces.ts
export interface UserCredentials {
  username: string;
  password: string;
}

export interface LoginResponse {
  success: boolean;
  message: string;
  token?: string;
}

export enum TransactionType {
  ORDER = 'ORDER',
  ASN = 'ASN'
}

export enum FormatType {
  EDI = 'EDI',
  JSON = 'JSON'
}

export enum ResponseType {
  ACK = 'ACK',
  SHIPCONF = 'SHIPCONF',
  RECEIPT = 'RECEIPT',
  GETSCHEMA = 'GETSCHEMA'  // New option added
}

export interface DashboardFormData {
  transactionType: TransactionType;
  format: FormatType;
  responseType: ResponseType;
}

export interface FileData {
  fileName: string;
  content: string;
  mimeType: string;
}

export interface ProcessingRequest {
  metadata: {
    transactionType: TransactionType;
    format: FormatType;
    responseType: ResponseType;
    timestamp: string;
  };
  fileData: FileData;
}

export interface ProcessingResponse {
  success: boolean;
  filename: string;
  content: string;
  mimeType: string;
  message?: string;
}

export interface ErrorResponse {
  error: boolean;
  message: string;
  statusCode?: number;
}

export interface DropdownOption {
  value: string;
  label: string;
}
