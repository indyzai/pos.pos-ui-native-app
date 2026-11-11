# Playwright end-to-end tests

Run from the native repository root. One suite targets the sibling React app (`../pos.pos-ui-new`) and both Expo React Native Web apps. No production application code or authentication bypass is added.

## Setup

```sh
bun install
bun x playwright install chromium
# Start in separate terminals:
bun run e2e:pos:web
bun run e2e:admin:web
cd ../pos.pos-ui-new && yarn dev
```

Use disposable test tenants: the customer tests create real records and reconnecting can synchronize them to the configured API. Existing `.env` files select the API environment; point them at your test services before capturing sessions. There is no automatic record deletion.

Provide an English test account for each surface. POS needs a manager account; Admin needs an owner/admin account. Enable all features exercised by the route matrix, provide branch/device registration, and open the POS counter. Seed a simple retail product with stock and a searchable customer. Start with an empty cart and no held orders.

Capture each session through the real UI:

```sh
bun run e2e:session react
bun run e2e:session pos
bun run e2e:session admin
export E2E_PRODUCT='Your seeded product'
export E2E_CACHED_CUSTOMER='Your seeded customer'
bun run test:e2e
```

Capture includes cookies, local storage and IndexedDB. The three ignored `e2e/.auth/*.json` files contain credentials and tenant data; keep them private. Refresh expired sessions using the same commands. Missing sessions and seed names fail with an explicit message rather than silently skipping coverage. Session storage is not captured; complete authentication before saving.

Override destinations with `E2E_REACT_URL`, `E2E_POS_URL`, `E2E_ADMIN_URL`. The React URL includes its locale prefix (default `http://localhost:3510/en`). URLs must match those used during capture. Override session paths with `E2E_REACT_STATE`, `E2E_POS_STATE`, `E2E_ADMIN_STATE`.

```sh
bun run test:e2e --project=react
bun run test:e2e --project=pos-tablet
bun run test:e2e --project=admin-phone
bun run test:e2e --project=pos-tablet e2e/specs/auth.pw.ts
bun run test:e2e:list
bun run test:e2e:ui
bun run test:e2e:report
bun x tsc -p e2e/tsconfig.json
```

Tests use `.pw.ts` so Bun's existing unit test discovery does not run Playwright specs. Single-worker execution avoids simultaneous mutations against the same account. Failed tests retain screenshots, video and traces, which can also contain tenant data.

## Coverage and limits

| Area                      | Checks                                                                                                                                           |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Native authentication     | Password masking and visibility toggle; anonymous protected deep-link redirect                                                                   |
| Route matrix              | React business routes and native navigation destinations render expected content, keep their URL, reload, and produce no uncaught browser errors |
| Customers, all surfaces   | Create online/offline, show in search, verify actual IndexedDB persistence and the offline sync job, reconnect and reload                        |
| Cached data, all surfaces | Seeded customer remains searchable through three disconnect/reconnect cycles                                                                     |
| POS tablet billing        | Product filtering, add to cart, hold to IndexedDB, resume and clear, online/offline                                                              |
| Layouts                   | React desktop; native phone and landscape tablet browser viewports                                                                               |

Route checks are smoke coverage, not complete business-flow coverage. The matrix assumes permissions and feature flags allow each destination; an unexpected access redirect fails. Tests for a different surface are explicitly skipped. Unlinked native route files are not automatically treated as supported flows.

Offline tests use real `context.setOffline(true)` after the app has loaded. They keep running the loaded application and perform real local writes. Reconnection and reload verify persisted data. They do **not** prove cold launch while offline, successful server acknowledgement, queue draining, retry idempotency, conflict resolution or multi-device convergence. Those need controlled API fixtures and queue-specific assertions.

Further transaction coverage is required for completed checkout/payment/refunds; customer edit/delete; inventory adjustments and stock counts; purchases; transfers; restaurant/pharmacy/electronics/service variants; finance; role denials; settings mutations; and failed-job correction. Hardware printing, scanners, biometric login, native SQLite and iOS/Android lifecycle behavior require native device tests (for example Maestro or Detox), because these Playwright projects execute React Native Web, not the installed native binary.

## Dedicated release tenant

The release E2E tenant is `POS E2E 20261111-d9850249` (ID `7728e717-13ab-456e-9895-283d24a05f03`). Its generated owner credentials, manager PIN, API tokens and seed IDs are saved only in ignored `e2e/.auth/release-tenant.json` with owner-only file permissions. It has `E2E Branch`, `E2E Counter`, and `E2E Retail Product`.

```sh
bun run e2e:release:provision
bun run e2e:release:seed
# Start Admin with release API URLs before capturing:
EXPO_PUBLIC_AUTH_API_URL=https://api.indyzai.com/auth/api/v1 \
EXPO_PUBLIC_POS_API_URL=https://api.indyzai.com/pos/api/graphql \
EXPO_PUBLIC_POS_BASE_URL=https://api.indyzai.com/pos/api \
bun run e2e:admin:web
bun run e2e:release:admin-session
bun run test:e2e --project=admin-tablet e2e/specs/customers.pw.ts
```

Provisioning reuses the saved manifest and never silently creates a second tenant after a request with an uncertain outcome. Seeding is restricted to the saved tenant and reuses persisted seed IDs. When this manifest exists, authenticated test sessions must select its tenant ID before tests run. Product and cached customer names default from its seed manifest. The Admin session capture signs in through the real login form and seeds the cached customer through the UI. React and POS sessions still use the normal capture command; the POS app must use its manager account rather than the owner login.

Release validation on 2026-11-11: tenant creation, authenticated POS organization lookup, branch/counter creation, product creation and manager creation succeeded. Local Admin login is currently blocked by release CORS: the auth preflight for `http://localhost:3512` returns HTTP 500 without `Access-Control-Allow-Origin`; `https://pos.indyzai.com` returns HTTP 204 with the expected origin header. A release configuration update to allow the required local E2E origins, or deploying the native web targets on explicitly allowed test origins, is needed before the local browser sessions can be captured. No CORS protections were disabled. The cached customer is created only after that browser login succeeds.

The deployed React app can run without changing CORS. Its E2E owner session has been captured through the real release sign-in page, and the online customer creation/persistence test passed against this tenant:

```sh
bun run e2e:release:react-session
bun run e2e:release:react-seed
E2E_REACT_URL=https://pos.indyzai.com bun run test:e2e --project=react e2e/specs/customers.pw.ts
```

The session and seed scripts use only the saved E2E identity. Never replace the state files with a normal business account: the tenant check deliberately rejects it.

All three React customer scenarios passed against release on 2026-11-11: online create/persistence/reload, offline create with durable sync job followed by reconnect/reload, and cached search through three disconnect/reconnect cycles. Re-run with `bun run test:e2e:release:react e2e/specs/customers.pw.ts`. This confirms the dedicated tenant is used for actual testing; it does not imply the entire route or transaction suite has passed.
