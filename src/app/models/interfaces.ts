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
  ASN = 'ASN',
  GETSCHEMA = 'GETSCHEMA',
  ERRORRESPONSE = 'ERRORRESPONSE',
  ERRORTIMEOUT = 'ERRORTIMEOUT'
}

// Order Type - only shown when Transaction Type is ORDER
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
  SHIPCONFIRM = 'SHIPCONFIRM',
  RECEIPT = 'RECEIPT',
  ORDER = 'ORDER',
  ASN = 'ASN',
  ITEM = 'ITEM'
}

// Request structure to send to Spring Boot backend
export interface BackendRequest {
  UUID: string;  // Unique identifier for each transaction
  Request: {
    'TRANSACTION TYPE': string;
    'ORDER TYPE'?: string;  // Optional - only when Transaction Type is ORDER
    'FORMAT': string;
    'RESPONSE TYPE': string;
    'Input File'?: string;  // Optional - only sent when file is uploaded
  };
}

// Single file response item in the array
export interface ProcessingResponseItem {
  success: boolean;
  filename: string;
  content: string;
  mimeType: string;
  message: string;
}

// Response from Spring Boot backend - now contains array of files
export interface ProcessingResponse {
  response: ProcessingResponseItem[];
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
