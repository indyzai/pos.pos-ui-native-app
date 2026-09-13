import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

let onlineManager: {
  isOnline: () => boolean;
  setOnline: (status: boolean) => void;
  subscribe: (callback: (status: boolean) => void) => () => void;
} | null = null;

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const rq = require('@tanstack/react-query');
  if (rq?.onlineManager) {
    onlineManager = rq.onlineManager;
  }
} catch {
  // Optional in environments where react-query is not bundled
}

export type NetworkStatusAuthApi = {
  checkHealth?: (signal?: AbortSignal) => Promise<boolean>;
  getHealthStatus?: (signal?: AbortSignal) => Promise<boolean>;
  getRuntimeApiUrls?: () => Promise<{ authApiUrl?: string; posApiUrl?: string }>;
};

export type UseNetworkStatusOptions = {
  /** Request timeout for the health check in ms (default: 10_000ms) */
  timeoutMs?: number;
  /** Background polling interval while active in ms (default: 30_000ms) */
  intervalMs?: number;
  /** Duration of inactivity before user is considered idle in ms (default: 120_000ms / 2 mins) */
  idleTimeoutMs?: number;
};

let defaultAuthApi: NetworkStatusAuthApi | null = null;

export function setNetworkStatusAuthApi(api: NetworkStatusAuthApi | null): void {
  defaultAuthApi = api;
}

export function getNetworkStatusAuthApi(): NetworkStatusAuthApi | null {
  return defaultAuthApi;
}

/**
 * Robust, zero-native-dependency network status hook.
 * Uses TanStack Query's onlineManager, browser navigator.onLine when available,
 * and lightweight background reachability checks using authApi instead of hardcoded URLs.
 *
 * Only triggers health checks when the user is actively interacting with the UI
 * or when the app/window returns to the foreground.
 */
export function useNetworkStatus(
  authApi?: NetworkStatusAuthApi,
  options?: UseNetworkStatusOptions,
): boolean {
  const activeApi = authApi ?? defaultAuthApi;
  const timeoutMs = options?.timeoutMs ?? 10000;
  const intervalMs = options?.intervalMs ?? 30000;
  const idleTimeoutMs = options?.idleTimeoutMs ?? 120000;

  const [isOnline, setIsOnline] = useState<boolean>(() => {
    if (typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean') {
      return navigator.onLine;
    }
    return onlineManager ? onlineManager.isOnline() : true;
  });

  useEffect(() => {
    let mounted = true;
    let isChecking = false;
    let lastCheckedTime = 0;
    let lastInteractionTime = Date.now();

    const isUserActive = (): boolean => {
      // 1. Web visibility check: tab must be visible
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
        return false;
      }
      // 2. React Native AppState check: app must be active in foreground
      if (typeof AppState !== 'undefined' && AppState?.currentState && AppState.currentState !== 'active') {
        return false;
      }
      // 3. Web idle timeout check: must have interacted within idleTimeoutMs
      if (typeof window !== 'undefined' && typeof document !== 'undefined') {
        if (Date.now() - lastInteractionTime > idleTimeoutMs) {
          return false;
        }
      }
      return true;
    };

    // 1. Subscribe to onlineManager if available
    const unsubscribe = onlineManager?.subscribe?.((status: boolean) => {
      if (mounted) setIsOnline(status);
    });

    // 2. Web event listeners if in browser / web context
    const handleOnline = () => {
      if (mounted) {
        setIsOnline(true);
        onlineManager?.setOnline(true);
        void triggerHealthCheck(true);
      }
    };
    const handleOffline = () => {
      if (mounted) {
        setIsOnline(false);
        onlineManager?.setOnline(false);
      }
    };

    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
    }

    // 3. Reachability check via authApi with increased timeout
    const checkReachability = async () => {
      try {
        if (typeof navigator !== 'undefined' && navigator.onLine === false) {
          handleOffline();
          return;
        }
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), timeoutMs);
        let reachable = false;

        if (activeApi?.checkHealth) {
          reachable = await activeApi.checkHealth(controller.signal);
        } else if (activeApi?.getHealthStatus) {
          reachable = await activeApi.getHealthStatus(controller.signal);
        } else if (activeApi?.getRuntimeApiUrls) {
          const { authApiUrl } = await activeApi.getRuntimeApiUrls();
          if (authApiUrl) {
            const healthUrl = authApiUrl.replace(/\/api\/v1\/?$/, '/api/health');
            const res = await fetch(healthUrl, {
              method: 'GET',
              signal: controller.signal,
            }).catch(() => null);
            reachable = res !== null && res.status > 0 && res.status < 500;
          }
        } else {
          reachable = onlineManager ? onlineManager.isOnline() : true;
        }

        clearTimeout(timeout);
        if (mounted) {
          setIsOnline(reachable);
          onlineManager?.setOnline(reachable);
        }
      } catch {
        // Ignored, maintain last known state
      }
    };

    const triggerHealthCheck = async (force = false) => {
      if (isChecking) return;
      // Minimum 4s throttle unless forced
      if (!force && Date.now() - lastCheckedTime < 4000) return;
      isChecking = true;
      lastCheckedTime = Date.now();
      try {
        await checkReachability();
      } finally {
        isChecking = false;
      }
    };

    // User activity listeners
    const onUserActivity = () => {
      const wasIdle = Date.now() - lastInteractionTime > idleTimeoutMs;
      lastInteractionTime = Date.now();
      if (wasIdle && isUserActive()) {
        void triggerHealthCheck();
      }
    };

    const handleFocusOrVisible = () => {
      lastInteractionTime = Date.now();
      if (isUserActive()) {
        void triggerHealthCheck(true);
      }
    };

    // React Native AppState listener (fires when returning from background)
    const appStateSubscription = AppState?.addEventListener?.('change', (status) => {
      if (status === 'active') {
        lastInteractionTime = Date.now();
        void triggerHealthCheck(true);
      }
    });

    // Web visibility & focus listeners
    if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
      document.addEventListener('visibilitychange', handleFocusOrVisible);
    }
    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      window.addEventListener('focus', handleFocusOrVisible);
      const activityEvents = ['pointerdown', 'keydown', 'touchstart'];
      activityEvents.forEach((event) => {
        window.addEventListener(event, onUserActivity, { passive: true });
      });
    }

    // Initial check only if active
    if (isUserActive()) {
      void triggerHealthCheck(true);
    }

    // Periodic check: ONLY fires when user is active in the UI
    const interval = setInterval(() => {
      if (isUserActive()) {
        void triggerHealthCheck();
      }
    }, intervalMs);

    return () => {
      mounted = false;
      clearInterval(interval);
      unsubscribe?.();
      appStateSubscription?.remove?.();
      if (typeof window !== 'undefined' && typeof window.removeEventListener === 'function') {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
        window.removeEventListener('focus', handleFocusOrVisible);
        const activityEvents = ['pointerdown', 'keydown', 'touchstart'];
        activityEvents.forEach((event) => {
          window.removeEventListener(event, onUserActivity);
        });
      }
      if (typeof document !== 'undefined' && typeof document.removeEventListener === 'function') {
        document.removeEventListener('visibilitychange', handleFocusOrVisible);
      }
    };
  }, [activeApi, timeoutMs, intervalMs, idleTimeoutMs]);

  return isOnline;
}

