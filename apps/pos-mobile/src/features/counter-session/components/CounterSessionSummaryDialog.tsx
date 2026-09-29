import {
  CounterSessionSummaryDialog as SharedDialog,
  type CounterSessionSummaryDialogProps,
} from '@indyzai/feature-organization/counter-summary-dialog';
import { dialogServices } from '../dialogServices';

export function CounterSessionSummaryDialog(props: Omit<CounterSessionSummaryDialogProps, 'services'>) {
  return <SharedDialog {...props} services={dialogServices} />;
}
