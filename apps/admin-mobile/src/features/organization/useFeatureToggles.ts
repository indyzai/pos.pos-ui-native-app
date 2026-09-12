import { useMemo } from 'react';
import { useAuthSession } from '../auth/AuthSessionContext';
import { featureToggleLabels, resolveFeatureToggles, type FeatureToggleKey } from './featureToggles';

export { featureToggleLabels } from './featureToggles';

export function useFeatureToggles() {
    const { session } = useAuthSession();
    const flags = useMemo(
        () => resolveFeatureToggles(session?.organization?.settings),
        [session?.organization?.settings],
    );
    return {
        flags,
        isEnabled: (key: FeatureToggleKey) => flags[key] === true,
        entries: Object.entries(flags).sort(([a], [b]) =>
            (featureToggleLabels[a] || a).localeCompare(featureToggleLabels[b] || b),
        ),
    };
}
