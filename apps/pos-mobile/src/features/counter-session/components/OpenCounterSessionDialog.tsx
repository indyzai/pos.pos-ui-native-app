import {
  OpenCounterSessionDialog as SharedDialog,
  type OpenCounterSessionDialogProps,
} from '@indyzai/feature-organization/open-counter-dialog';
import { dialogServices } from '../dialogServices';

export function OpenCounterSessionDialog(props: Omit<OpenCounterSessionDialogProps, 'services'>) {
  return <SharedDialog {...props} services={dialogServices} />;
}
