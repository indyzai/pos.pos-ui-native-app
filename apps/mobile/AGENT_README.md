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
│   └── billing/                      # Billing UI, hooks, types, and persistence repository
├── shared/                           # Reusable UI, navigation, providers, and QueryClient
├── storage/                          # Cross-platform key-value storage
└── sync/                             # Serialized foreground work and shared mutation types
```

Only Products and Sales are currently implemented in the offline layer. Add other domains only when their API contract and conflict rules are known.

All HTTP requests use core/api/baseApi.ts for JSON, headers, timeouts, and HTTP/GraphQL errors. POS features use core/api/posApi.ts for the shared endpoint and authenticated tenant headers. Keep payload mapping, session storage, and business-switch checks in features. Do not add direct fetch calls or automatic request retries to feature modules.

Local storage initializes through DatabaseProvider (IndexedDB on web, lazy SQLite/Drizzle on native). Its status and retry action appear beside the theme switch. Billing queries wait for both session bootstrap and storage readiness, and use user/tenant query keys. Auth refresh keeps routes mounted under a loader; organization failures retain the resolved identity and surface a retryable error.

`AuthSessionProvider` is the only application bootstrap for identity and selected business. It loads the authenticated profile, organization configuration, and active counter session before routes render. Do not add screen-level token/tenant initialization; consume `useAuthSession` for UI and `getActiveAuthSession` only in non-React feature services.

## Rules for every offline feature

1. Keep tokens and device credentials in SecureStore. Expo SQLite stores business data only; never store credentials in its tables.
2. Scope persisted data by signed-in user and tenant. Never expose one business's cache to another.
3. Write an outbound mutation to storage before changing UI state that would make it appear complete.
4. Assign a stable client ID (`offlineId`) once and reuse it for every retry. The server must deduplicate it per tenant.
5. Replay mutations sequentially. On failure, retain the failed item at the head of the queue with its error; do not drop later work.
6. Billing refresh and sale uploads are manual only, via the header Refresh button. Do not add mount, timer, foreground, reconnect, or post-checkout sync. Startup auth/organization initialization and local cache reads remain enabled.
7. Keep transport contracts in the domain feature. The current products/sales transport is POS GraphQL; do not introduce the pasted example's `/sync/jobs` endpoints unless the backend provides them.

## Products and sales flow

`catalogApi.ts` downloads and maps paginated products. `salesOutbox.ts` turns a cart into an immutable `saveBill(NewBillInput)` payload, writes it to the Drizzle-managed SQLite sales table, and retries the exact payload during sync. `features/billing/data/billingRepository.ts` owns the SQL mapping for products, sales, and counter-session metadata. `billingApi.ts` only composes authenticated request handling, storage scope, and those feature modules. `useBillingData.ts` uses TanStack Query for cache invalidation and refresh state.

Native builds use `expo-sqlite` through Drizzle ORM. Drizzle's Expo driver uses synchronous SQLite calls, so keep catalog writes bounded and do not add large processing loops on the UI thread. No WatermelonDB Babel transform or Expo config plugin is needed.

Expo web does not initialize `expo-sqlite` because its browser runtime can require `SharedArrayBuffer`. Billing uses IndexedDB on web and Expo SQLite on native. Keep all direct persistence access behind `features/billing/data/billingRepository.ts` so this platform split remains contained.

Schema changes belong in `src/db/schema` and `src/db/migrations.ts`, with generated SQL checked into `drizzle/`. Do not have feature UI call Drizzle directly; keep persistence behind a feature repository and invalidate the related TanStack Query key after a mutation.

The API endpoint defaults to `https://api.indyzai.com/pos/api/graphql`. Override it with `EXPO_PUBLIC_POS_API_URL` for non-production environments.

## Checklist when adding a feature

- Create `src/features/<feature>/` with its types, API mapping, and offline/outbox logic.
- Add Expo Router screens under `src/app/`; do not recreate a root-level `app/` directory.
- Reuse the Drizzle repository, TanStack Query client, and `SerialQueue`; do not write directly to SQLite tables from UI components.
- Add focused Bun tests under `apps/mobile/tests/features/<feature>/` for persistence, retry, and tenant isolation.
- Run `bun test apps/mobile/tests`, `bunx tsc --noEmit -p apps/mobile/tsconfig.json`, and `bun run format:check` before handing over.
- Update this guide with the feature's API contract, cache key, and reconciliation rules.
