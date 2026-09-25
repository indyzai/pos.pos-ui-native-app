import { useEffect, useMemo, useState } from "react";
import { useAuthSession } from "@indyzai/pos-auth/session";
import {
    featureToggleLabels,
    resolveFeatureToggles,
    type FeatureToggleKey,
} from "./index";

export { featureToggleLabels } from "./index";

export function useFeatureToggles() {
    const { session } = useAuthSession();
    const settings = session?.organization?.settings;
    const [revision, setRevision] = useState(0);
    useEffect(() => {
        const records = Array.isArray(settings?.featureFlags)
            ? settings.featureFlags
            : [];
        const now = Date.now();
        const dates = records
            .flatMap((record) =>
                record && typeof record === "object"
                    ? [
                          Date.parse(record.effective_from),
                          Date.parse(record.effective_to),
                      ]
                    : [],
            )
            .filter((date) => Number.isFinite(date) && date > now);
        if (!dates.length) return;
        const timer = setTimeout(
            () => setRevision((value) => value + 1),
            Math.min(Math.min(...dates) - now, 2147483647),
        );
        return () => clearTimeout(timer);
    }, [settings, revision]);
    const flags = useMemo(
        () => resolveFeatureToggles(settings),
        [settings, revision],
    );
    return {
        flags,
        isEnabled: (key: FeatureToggleKey) => flags[key] === true,
        entries: Object.entries(flags).sort(([a], [b]) =>
            (featureToggleLabels[a] || a).localeCompare(
                featureToggleLabels[b] || b,
            ),
        ),
    };
}
