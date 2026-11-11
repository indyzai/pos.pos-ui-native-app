import { randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const directory = resolve('e2e/.auth');
const manifestPath = resolve(directory, 'release-tenant.json');
await mkdir(directory, { recursive: true, mode: 0o700 });
let manifest;
try {
  manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
  const suffix = `${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${randomBytes(4).toString('hex')}`;
  const domain = `pos-e2e-${suffix}.invalid`;
  manifest = {
    authURL: 'https://api.indyzai.com/auth/api/v1',
    posURL: 'https://api.indyzai.com/pos/api/graphql',
    status: 'prepared',
    registration: {
      fullName: 'POS E2E Owner',
      email: `owner@${domain}`,
      password: randomBytes(32).toString('base64url'),
      companyName: `POS E2E ${suffix}`,
      domainName: domain,
      organizationType: 'Small Business',
      industry: 'Retail',
    },
  };
  // Save the identity before sending any mutation, so retries cannot create duplicate tenants.
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600, flag: 'wx' });
}
if (manifest.status === 'created') {
  console.log(`Existing E2E tenant: ${manifest.registration.companyName}`);
  process.exit(0);
}
if (manifest.status !== 'prepared')
  throw new Error('Previous request has an uncertain outcome. Reconcile the saved identity before retrying.');
manifest.status = 'requesting';
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 });
const response = await fetch(`${manifest.authURL}/auth/register`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(manifest.registration),
  signal: AbortSignal.timeout(30_000),
});
const body = await response.json();
manifest.httpStatus = response.status;
if (!response.ok) {
  manifest.status = 'rejected';
  manifest.error = body.message ?? body.error ?? 'Registration rejected';
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 });
  throw new Error(`Registration rejected (${response.status}): ${JSON.stringify(manifest.error)}`);
}
manifest.status = 'created';
manifest.createdAt = new Date().toISOString();
manifest.response = body;
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 });
console.log(`Created E2E tenant: ${manifest.registration.companyName}`);
console.log('Saved credentials and registration response privately in e2e/.auth/release-tenant.json');
