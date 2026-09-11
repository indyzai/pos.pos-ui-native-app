export type WaybillJob = {
  id: string;
  saleOfflineId: string;
  payload: Record<string, unknown>;
  status: 'PENDING' | 'FAILED';
  error?: string;
  createdAt: string;
};
