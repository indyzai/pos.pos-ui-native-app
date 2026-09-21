export interface PrintDocument {
  title?: string;
  content: string;
  contentType: 'text' | 'html';
}

export interface Printer {
  print(document: PrintDocument): Promise<void>;
}
