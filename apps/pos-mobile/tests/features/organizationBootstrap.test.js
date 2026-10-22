import { expect, test } from 'bun:test';

test('initial organization bootstrap loads the optional email domain for both apps', () => {
  const posApi = new URL('../../src/features/organization/organizationApi.ts', import.meta.url).pathname;
  const adminApi = new URL(
    '../../../admin-mobile/src/features/organization/organizationApi.ts',
    import.meta.url,
  ).pathname;
  const script = `
    import { mock } from 'bun:test';
    import { strict as assert } from 'node:assert';
    const organization = { id: 'tenant', name: 'Shop', domain: ' Shop.Example ', config: {}, activeSession: null, branches: [] };
    const request = async (_token, _tenant, query) => {
      assert.match(query, /id name domain/);
      return { organization };
    };
    mock.module(${JSON.stringify(new URL('../../src/core/api/posApi.ts', import.meta.url).pathname)}, () => ({ requestPos: request }));
    mock.module(${JSON.stringify(new URL('../../../admin-mobile/src/core/api/posApi.ts', import.meta.url).pathname)}, () => ({ requestPos: request }));
    mock.module(${JSON.stringify(new URL('../../src/features/settings/settingsApi.ts', import.meta.url).pathname)}, () => ({ settingsApi: {} }));
    mock.module(${JSON.stringify(new URL('../../../admin-mobile/src/features/settings/settingsApi.ts', import.meta.url).pathname)}, () => ({ settingsApi: {} }));
    mock.module('@indyzai/feature-organization/counterSessionApi', () => ({ queueOpenCounter() {}, queueCloseCounter() {} }));
    mock.module('@indyzai/pos-database', () => ({ getActiveDatabase() {} }));
    mock.module('@indyzai/pos-auth/session', () => ({ getActiveAuthSession() {} }));
    mock.module('@indyzai/feature-organization/organizationCache', () => ({ createOrganizationCache: () => ({}) }));
    for (const path of ${JSON.stringify([posApi, adminApi])}) {
      organization.domain = ' Shop.Example ';
      const { refreshOrganizationDetails } = await import(path);
      assert.equal((await refreshOrganizationDetails('token', 'tenant')).domain, 'shop.example');
      delete organization.domain;
      assert.equal((await refreshOrganizationDetails('token', 'tenant')).domain, undefined);
    }
  `;
  const result = Bun.spawnSync([process.execPath, '-e', script]);
  expect(result.stderr.toString()).toBe('');
  expect(result.exitCode).toBe(0);
});
