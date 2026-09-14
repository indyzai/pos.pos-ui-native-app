import { mock } from 'bun:test';

mock.module('react-native', () => ({
  Platform: {
    OS: 'web',
    select: (obj: Record<string, unknown>) => obj?.web ?? obj?.default,
  },
  StyleSheet: {
    create: (styles: unknown) => styles,
    hairlineWidth: 1,
  },
  Dimensions: {
    get: () => ({ width: 1024, height: 768 }),
  },
}));
