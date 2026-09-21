import { useEffect, useRef, useState } from "react";
import { AppState } from "react-native";

let onlineManager: {
  isOnline: () => boolean;
  setOnline: (status: boolean) => void;
  subscribe: (callback: (status: boolean) => void) => () => void;
} | null = null;
try {
  onlineManager = require("@tanstack/react-query")?.onlineManager ?? null;
} catch { }

export type NetworkStatusAuthApi = {
  checkHealth?: (signal?: AbortSignal) => Promise<boolean>;
  getHealthStatus?: (signal?: AbortSignal) => Promise<boolean>;
  getRuntimeApiUrls?: () => Promise<{
    authApiUrl?: string;
    posApiUrl?: string;
  }>;
};
export type UseNetworkStatusOptions = {
  timeoutMs?: number;
  intervalMs?: number;
  pendingSyncCount?: number;
};

let defaultAuthApi: NetworkStatusAuthApi | null = null;
export const setNetworkStatusAuthApi = (api: NetworkStatusAuthApi | null) => {
  defaultAuthApi = api;
};
export const getNetworkStatusAuthApi = () => defaultAuthApi;

/** Makes one initial health request, then checks only while offline or sync work is pending. */
export function useNetworkStatus(
  authApi?: NetworkStatusAuthApi,
  options?: UseNetworkStatusOptions,
): boolean {
  const activeApi = authApi ?? defaultAuthApi;
  const timeoutMs = options?.timeoutMs ?? 10000;
  const intervalMs = options?.intervalMs ?? 3000000;
  const browserOnline =
    typeof navigator !== "undefined" ? navigator.onLine : undefined;
  const initialStatus = browserOnline ?? onlineManager?.isOnline() ?? true;
  const [isOnline, setIsOnline] = useState(initialStatus);
  const onlineRef = useRef(initialStatus);
  const pendingRef = useRef(options?.pendingSyncCount ?? 0);
  const checkRef = useRef<() => void>(() => undefined);
  pendingRef.current = options?.pendingSyncCount ?? 0;

  useEffect(() => {
    let mounted = true;
    let checking = false;
    const publish = (status: boolean) => {
      onlineRef.current = status;
      if (mounted) setIsOnline(status);
      onlineManager?.setOnline(status);
    };
    const checkHealth = async () => {
      if (checking) return;
      checking = true;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      try {
        if (
          typeof navigator !== "undefined" &&
          navigator.onLine === false
        )
          return publish(false);
        let reachable = onlineManager?.isOnline() ?? true;
        if (activeApi?.checkHealth)
          reachable = await activeApi.checkHealth(controller.signal);
        else if (activeApi?.getHealthStatus)
          reachable = await activeApi.getHealthStatus(
            controller.signal,
          );
        else if (activeApi?.getRuntimeApiUrls) {
          const { authApiUrl } = await activeApi.getRuntimeApiUrls();
          if (authApiUrl) {
            const response = await fetch(
              authApiUrl.replace(/\/api\/v1\/?$/, "/api/health"),
              {
                signal: controller.signal,
              },
            );
            reachable =
              response.status > 0 && response.status < 500;
          }
        }
        publish(reachable);
      } catch {
        publish(false);
      } finally {
        clearTimeout(timeout);
        checking = false;
      }
    };
    checkRef.current = () => void checkHealth();

    const unsubscribe = onlineManager?.subscribe((status) => {
      onlineRef.current = status;
      if (mounted) setIsOnline(status);
    });
    const handleOnline = () => void checkHealth();
    const handleOffline = () => publish(false);
    if (
      typeof window !== "undefined" &&
      typeof window.addEventListener === "function"
    ) {
      window.addEventListener("online", handleOnline);
      window.addEventListener("offline", handleOffline);
    }
    const appState = AppState.addEventListener("change", (status) => {
      if (
        status === "active" &&
        (!onlineRef.current || pendingRef.current > 0)
      )
        void checkHealth();
    });

    void checkHealth();
    const interval = setInterval(() => {
      if (!onlineRef.current || pendingRef.current > 0)
        void checkHealth();
    }, intervalMs);
    return () => {
      mounted = false;
      checkRef.current = () => undefined;
      clearInterval(interval);
      unsubscribe?.();
      appState.remove();
      if (
        typeof window !== "undefined" &&
        typeof window.removeEventListener === "function"
      ) {
        window.removeEventListener("online", handleOnline);
        window.removeEventListener("offline", handleOffline);
      }
    };
  }, [activeApi, intervalMs, timeoutMs]);
  useEffect(() => {
    if ((options?.pendingSyncCount ?? 0) > 0) checkRef.current();
  }, [options?.pendingSyncCount]);
  return isOnline;
}
