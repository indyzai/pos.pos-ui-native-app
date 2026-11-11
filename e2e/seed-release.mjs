import { readFile, writeFile } from 'node:fs/promises';
import { randomInt } from 'node:crypto';
const path = 'e2e/.auth/release-tenant.json';
const manifest = JSON.parse(await readFile(path, 'utf8'));
const registration = manifest.response.data ?? manifest.response;
const tenant = registration.user.tenant;
if (
  manifest.status !== 'created' ||
  !tenant.name.startsWith('POS E2E ') ||
  tenant.domain !== manifest.registration.domainName
)
  throw new Error('Expected the dedicated E2E tenant');
const save = () => writeFile(path, JSON.stringify(manifest, null, 2) + '\n', { mode: 0o600 });
const token = registration.accessToken ?? registration.tokens?.accessToken;
async function gql(query, variables = {}) {
  const response = await fetch(manifest.posURL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'x-tenant-id': tenant.id,
    },
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(30000),
  });
  const result = await response.json();
  if (!response.ok || result.errors?.length)
    throw new Error(JSON.stringify(result.errors ?? { status: response.status }));
  return result.data;
}
manifest.tenantId = tenant.id;
manifest.seed ??= {};
if (!manifest.seed.branch) {
  const result = await gql(
    'query($id: String!) { organization(id: $id) { branches { id name counters { id name } } } }',
    { id: tenant.id },
  );
  let branch = result.organization.branches.find((branch) => branch.name === 'E2E Branch');
  if (!branch) {
    const created = await gql(
      'mutation($branches: [BranchInput!]!) { createBranchesAndCounters(branches: $branches) { id name counters { id name } } }',
      { branches: [{ name: 'E2E Branch', counters: [{ name: 'E2E Counter' }] }] },
    );
    branch = created.createBranchesAndCounters.find((branch) => branch.name === 'E2E Branch');
  }
  if (!branch) throw new Error('Branch was not returned');
  manifest.seed.branch = branch;
  await save();
  console.log('Verified E2E branch and counter');
}
if (!manifest.seed.product) {
  const result = await gql(
    'mutation($input: NewProductInput!) { newProduct(newProductData: $input) { success message product { id name } } }',
    {
      input: {
        clientMutationId: `e2e-product-${tenant.id}`,
        name: 'E2E Retail Product',
        price: 10,
        quantity: 1000,
        stock: 1000,
        skuCode: 'E2E-RETAIL-001',
        taxPercentage: 0,
      },
    },
  );
  if (!result.newProduct.success) throw new Error(result.newProduct.message);
  manifest.seed.product = result.newProduct.product;
  await save();
  console.log('Verified E2E retail product');
}
if (!manifest.seed.manager) {
  manifest.manager ??= {
    id: `e2e-manager-${tenant.id}`,
    name: 'E2E Manager',
    email: `manager@${tenant.domain}`,
    pin: String(randomInt(100000, 1000000)),
    role: 'manager',
    assignedBranchId: manifest.seed.branch.id,
    assignedCounterId: manifest.seed.branch.counters[0].id,
  };
  await save();
  const result = await gql('mutation($details: JSON!) { createDeviceUser(details: $details) }', {
    details: manifest.manager,
  });
  manifest.seed.manager = result.createDeviceUser;
  await save();
  console.log('Verified E2E manager');
}
console.log('Seeded dedicated release E2E tenant');
