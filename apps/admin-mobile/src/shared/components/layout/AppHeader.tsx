import { AppHeader as SharedAppHeader } from '@indyzai/feature-organization/app-header';
import { authApi } from '../../../auth/authApi';
import { OpenCounterSessionDialog } from '../../../features/counter-session/components/OpenCounterSessionDialog';
import { CounterSessionSummaryDialog } from '../../../features/counter-session/components/CounterSessionSummaryDialog';

type Props = {
  title?: string;
  subtitle?: string;
  initials?: string;
  onMenuToggle?: () => void;
  navigationCollapsed?: boolean;
};

export function AppHeader(props: Props) {
  return (
    <SharedAppHeader
      {...props}
      variant="admin"
      authApi={authApi}
      OpenCounterSessionDialog={OpenCounterSessionDialog}
      CounterSessionSummaryDialog={CounterSessionSummaryDialog}
    />
  );
}
