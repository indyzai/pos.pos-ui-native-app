import { GlobalDataLoaderView, useAppHeader } from '@indyzai/pos-ui-native';
import { useAuthSession } from '../../../auth/AuthSessionContext';

export function GlobalDataLoader() {
    const { authenticated, session } = useAuthSession();
    const { featureLoading } = useAppHeader();
    if (!authenticated || !session || !featureLoading) return null;
    return <GlobalDataLoaderView title={featureLoading.title} message={featureLoading.message} />;
}
