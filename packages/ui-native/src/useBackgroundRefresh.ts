import { useEffect, useRef } from "react";
import { AppState } from "react-native";
import {
    getNetworkStatusSnapshot,
    subscribeNetworkStatus,
} from "./useNetworkStatus";

const running = new Set<string>();
const refreshedAt = new Map<string, number>();

/** Silent, bounded revalidation: callers continue rendering their local database. */
export function useBackgroundRefresh(
    key: string | undefined,
    refresh: (signal: AbortSignal) => Promise<unknown>,
) {
    const latest = useRef(refresh);
    latest.current = refresh;
    useEffect(() => {
        if (!key) return;
        let disposed = false;
        let controller: AbortController | undefined;
        let lastAttempt = 0;
        const attempt = async () => {
            if (
                disposed ||
                AppState.currentState === "background" ||
                getNetworkStatusSnapshot() !== true ||
                running.has(key) ||
                Date.now() - (refreshedAt.get(key) ?? 0) < 300_000 ||
                Date.now() - lastAttempt < 30_000
            )
                return;
            lastAttempt = Date.now();
            controller = new AbortController();
            const active = controller;
            // Paginated history can take longer on mobile networks; individual requests
            // retain their own transport timeout and never hold up the local UI.
            const timeout = setTimeout(() => active.abort(), 120_000);
            running.add(key);
            try {
                await latest.current(active.signal);
                if (!disposed && !active.signal.aborted)
                    refreshedAt.set(key, Date.now());
            } catch {
                /* Background failures never replace cached content or display a blocking error. */
            } finally {
                clearTimeout(timeout);
                running.delete(key);
            }
        };
        const initial = setTimeout(() => void attempt(), 1000);
        const retry = setInterval(() => void attempt(), 30_000);
        const unsubscribe = subscribeNetworkStatus(() => {
            if (getNetworkStatusSnapshot() === true) void attempt();
        });
        const appState = AppState.addEventListener("change", (state) => {
            if (state === "active") void attempt();
        });
        return () => {
            disposed = true;
            clearTimeout(initial);
            clearInterval(retry);
            unsubscribe();
            appState.remove();
            controller?.abort();
        };
    }, [key]);
}
