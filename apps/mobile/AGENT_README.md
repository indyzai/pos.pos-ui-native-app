# Mobile feature maintenance guide

This Expo app uses feature folders. Keep UI, domain logic, and offline persistence separate so a feature can be changed without coupling it to another feature.

## Current architecture

```text
src/
├── app/                              # Expo Router routes and root providers
├── config/                           # Environment and theme configuration
├── core/api/                         # Shared HTTP and POS GraphQL clients
├── db/                               # SQLite/IndexedDB clients, migrations, and schemas
├── features/
│   ├── auth/AuthSessionContext.tsx   # Single session bootstrap and startup loader
│   ├── organization/organizationApi.ts # Business config and active counter session
│   ├── products/catalogApi.ts       # Product catalog GraphQL query and mapping
│   ├── sales/salesOutbox.ts         # Offline sale creation and sequential replay
│   ├── billing/                      # Catalog/cart UI, domain rules, dialogs, and orchestration
│   ├── orders/                       # Cached orders and item-level refund outbox
│   ├── logistics/                    # Invoice-dependent waybill jobs
│   ├── scrap/                        # Scrap purchase jobs required before linked sales
│   ├── printing/                     # Printer configuration and durable print jobs
│   └── restaurant/                   # Cached table reference data
├── shared/                           # Reusable UI, navigation, providers, and QueryClient
├── storage/                          # Cross-platform key-value storage
└── sync/                             # Serialized foreground work and shared mutation types
```

Offline collections currently cover products, sales, held orders, customers, payment methods, tax rates, technicians, pharmacy batches, restaurant tables, orders, refunds, waybill jobs, scrap purchase jobs, printers, print jobs, and sync jobs. Each collection has its own schema/table/object store. Add another domain only after its API contract, dependency ordering, idempotency, and conflict rules are known.

All HTTP requests use core/api/baseApi.ts for JSON, headers, timeouts, and HTTP/GraphQL errors. POS features use core/api/posApi.ts for the shared endpoint and authenticated tenant headers. Keep payload mapping, session storage, and business-switch checks in features. Do not add direct fetch calls or automatic request retries to feature modules.

Local storage initializes through DatabaseProvider (IndexedDB on web, lazy SQLite/Drizzle on native). Its status and retry action appear beside the theme switch. Billing queries wait for both session bootstrap and storage readiness, and use user/tenant query keys. Auth refresh keeps routes mounted under a loader; organization failures retain the resolved identity and surface a retryable error.

`AuthSessionProvider` is the only application bootstrap for identity and selected business. It loads the authenticated profile, organization configuration, and active counter session before routes render. Do not add screen-level token/tenant initialization; consume `useAuthSession` for UI and `getActiveAuthSession` only in non-React feature services.

## Rules for every offline feature

1. Keep tokens and device credentials in SecureStore. Expo SQLite stores business data only; never store credentials in its tables.
2. Scope persisted data by signed-in user and tenant. Never expose one business's cache to another.
3. Write an outbound mutation to storage before changing UI state that would make it appear complete.
4. Assign a stable client ID (`offlineId`) once and reuse it for every retry. The server must deduplicate it per tenant.
5. Replay mutations sequentially. On failure, retain the failed item at the head of the queue with its error; do not drop later work.
6. Billing refresh and outbound uploads are manual only, via pull-to-refresh or the feature refresh action. Do not add mount, timer, foreground, reconnect, grid-scroll, or post-checkout sync. Startup auth/organization initialization and local cache reads remain enabled.
7. Keep transport contracts in the domain feature. The current products/sales transport is POS GraphQL; do not introduce the pasted example's `/sync/jobs` endpoints unless the backend provides them.

## Billing and dependent job flow

`catalogApi.ts` downloads and maps paginated products. `salesOutbox.ts` turns a cart into an immutable `saveBill(NewBillInput)` payload, writes it to the sales table, and retries the exact payload during sync. `billingApi.ts` composes authenticated requests, storage scope, reference collections, and dependency ordering. Scrap-purchase jobs upload before their linked sales; waybill jobs are created only after a sale receives its server invoice. Failed queue heads remain durable and stop dependent work.

Native builds use `expo-sqlite` through Drizzle ORM. Drizzle's Expo driver uses synchronous SQLite calls, so keep catalog writes bounded and do not add large processing loops on the UI thread. No WatermelonDB Babel transform or Expo config plugin is needed.

Expo web resolves the platform-safe `@indyzai/pos-database/client` export and therefore never imports `expo-sqlite`; this avoids its `SharedArrayBuffer`/WASM requirements. Web repositories use IndexedDB and native repositories use Expo SQLite. Keep persistence behind feature repositories so UI and domain code remain platform-neutral.

Schema changes belong in `packages/database/src/runtime/schema` and `packages/database/src/runtime/migrations.ts`, with generated SQL checked into `packages/database/drizzle/`. Do not have feature UI call Drizzle directly; keep persistence behind a feature repository and invalidate the related TanStack Query key after a mutation.

The API endpoint defaults to `https://api.indyzai.com/pos/api/graphql`. Override it with `EXPO_PUBLIC_POS_API_URL` for non-production environments.

## Checklist when adding a feature

- Create `src/features/<feature>/` with its types, API mapping, and offline/outbox logic.
- Add Expo Router screens under `src/app/`; do not recreate a root-level `app/` directory.
- Reuse feature repositories, the TanStack Query client, and `SerialQueue`; do not write directly to SQLite or IndexedDB from UI components.
- Add focused Bun tests under `apps/mobile/tests/features/<feature>/` for persistence, retry, and tenant isolation.
- Run `bun test apps/mobile/tests`, `bunx tsc --noEmit -p apps/mobile/tsconfig.json`, and `bun run format:check` before handing over.
- Update this guide with the feature's API contract, cache key, and reconciliation rules.
