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

// NEW: Order Type - only shown when Transaction Type is ORDER
export enum OrderType {
  LTL = 'LTL',
  PARCEL = 'PARCEL'
}

export enum FormatType {
  EDI = 'EDI',
  JSON = 'JSON'
}

export enum ResponseType {
  ACK = 'ACK',
  GETSCHEMA = 'GETSCHEMA',
  SHIPCONF = 'SHIPCONF',
  RECEIPT = 'RECEIPT'
}

// Request structure to send to Spring Boot backend
export interface BackendRequest {
  Request: {
    'TRANSACTION TYPE': string;
    'ORDER TYPE'?: string;  // Optional - only when Transaction Type is ORDER
    'FORMAT': string;
    'RESPONSE TYPE': string;
    'Input File'?: string;  // Optional - only sent when file is uploaded
  };
}

// Response from Spring Boot backend
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

export interface DashboardFormData {
  transactionType: TransactionType;
  orderType?: OrderType;  // Optional - only when Transaction Type is ORDER
  format: FormatType;
  responseType: ResponseType;
}

export interface DropdownOption {
  value: string;
  label: string;
}
