export interface ScanResult {
  value: string;
  format?: string;
}

export interface Scanner {
  scan(): Promise<ScanResult | null>;
}
