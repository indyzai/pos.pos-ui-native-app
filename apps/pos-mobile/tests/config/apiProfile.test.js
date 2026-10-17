import { expect, test } from 'bun:test';
import { resolveMobileApiProfile } from '../../src/config/apiProfile';

test('local profile uses localhost POS and auth APIs on native too', () => {
  expect(resolveMobileApiProfile({ environment: 'local' })).toEqual({
    environment: 'local',
    posApiUrl: 'http://localhost:3501/api/graphql',
    posBaseUrl: 'http://localhost:3501/api',
    authApiUrl: 'http://localhost:3504/api/v1',
  });
});
test('production is the default and supports configured public URLs', () => {
  expect(resolveMobileApiProfile({}).posApiUrl).toBe('https://api.indyzai.com/pos/api/graphql');
  expect(
    resolveMobileApiProfile({ environment: 'production', posApiUrl: 'https://example.test/graphql' })
      .posApiUrl,
  ).toBe('https://example.test/graphql');
});
test('local profile supports emulator or physical device hosts', () => {
  expect(
    resolveMobileApiProfile({ environment: 'local', posApiUrl: 'http://10.0.2.2:3501/api/graphql' })
      .posApiUrl,
  ).toBe('http://10.0.2.2:3501/api/graphql');
});
