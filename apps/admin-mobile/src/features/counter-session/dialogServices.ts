import { counterSessionApi } from './counterSessionApi';
import { loadDenominationCounts, saveDenominationCounts } from './denominationStorage';

export const dialogServices = {
  getDenominations: counterSessionApi.getDenominations,
  open: counterSessionApi.open,
  close: counterSessionApi.close,
  loadCounts: loadDenominationCounts,
  saveCounts: saveDenominationCounts,
};
