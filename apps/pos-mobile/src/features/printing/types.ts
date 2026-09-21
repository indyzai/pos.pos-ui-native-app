export type CounterPrinter = {
  id: string;
  name: string;
  counterId?: string;
  branchId?: string;
  type: string;
  printerTypes: string[];
  status: string;
  isDefault: boolean;
  isActive: boolean;
  copies: number;
  autoPrint: boolean;
};

export type PrintJob = {
  id: string;
  printerId: string;
  printerName: string;
  status: string;
  copies: number;
  createdAt: string;
};

export type LocalPrintJob = {
  id: string;
  printerId: string;
  printerName: string;
  counterId: string;
  branchId?: string;
  invoiceNumber: string;
  copies: number;
  status: 'QUEUED' | 'COMPLETED' | 'FAILED';
  createdAt: string;
  serverId?: string;
  error?: string;
};
