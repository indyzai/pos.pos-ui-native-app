import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

type HeaderContextValue = {
  menuToggle?: () => void;
  setMenuToggle: (handler?: () => void) => void;
  featureRefresh?: () => void | Promise<void>;
  featureRefreshing: boolean;
  setFeatureRefresh: (handler?: () => void | Promise<void>, refreshing?: boolean) => void;
  counterDialogRequest: number;
  requestCounterDialog: () => void;
};

const HeaderContext = createContext<HeaderContextValue | null>(null);

export function AppHeaderProvider({ children }: { children: ReactNode }) {
  const [menuToggle, setStoredMenuToggle] = useState<(() => void) | undefined>();
  const [featureRefresh, setStoredFeatureRefresh] = useState<(() => void | Promise<void>) | undefined>();
  const [featureRefreshing, setFeatureRefreshing] = useState(false);
  const [counterDialogRequest, setCounterDialogRequest] = useState(0);
  const setMenuToggle = useCallback((handler?: () => void) => {
    setStoredMenuToggle(() => handler);
  }, []);
  const setFeatureRefresh = useCallback((handler?: () => void | Promise<void>, refreshing = false) => {
    setStoredFeatureRefresh(() => handler);
    setFeatureRefreshing(refreshing);
  }, []);
  const requestCounterDialog = useCallback(() => setCounterDialogRequest((value) => value + 1), []);
  const value = useMemo(
    () => ({
      menuToggle,
      setMenuToggle,
      featureRefresh,
      featureRefreshing,
      setFeatureRefresh,
      counterDialogRequest,
      requestCounterDialog,
    }),
    [
      counterDialogRequest,
      featureRefresh,
      featureRefreshing,
      menuToggle,
      requestCounterDialog,
      setFeatureRefresh,
      setMenuToggle,
    ],
  );
  return <HeaderContext.Provider value={value}>{children}</HeaderContext.Provider>;
}

export function useAppHeader() {
  const context = useContext(HeaderContext);
  if (!context) throw new Error('useAppHeader must be used within AppHeaderProvider');
  return context;
}
