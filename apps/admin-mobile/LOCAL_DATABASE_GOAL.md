# Goal: Platform-Neutral, Role-Scoped Local POS Database

## Outcome

Provide one offline-first local persistence contract for the POS application while using the database appropriate to each platform:

```text
Android / iOS                         Web development only
React Native UI                      React Native Web UI
        |                                     |
shared hooks and repository contracts (no platform checks)
        |                                     |
SQLite adapter                        IndexedDB adapter
Expo SQLite + Drizzle ORM              Dexie + dexie-react-hooks
        \_____________________________________/
                          |
                    shared SyncEngine
                          |
                      GraphQL API
```

Production Android and iOS must continue to use Expo SQLite with Drizzle. IndexedDB is a development convenience for the browser and is not a supported production POS database.

The signed-in role determines which server collections are pulled and retained locally. Authorization remains enforced by the API; local role filtering is an additional least-data and UX boundary, not a security substitute.

## Current Baseline

The application already has:

- Expo SQLite and Drizzle schemas under `packages/database/src/runtime/schema`.
- A platform-resolved `@indyzai/pos-database/client` export that prevents SQLite from entering the web bundle.
- Raw IndexedDB storage in `packages/database/src/runtime/webClient.ts`.
- Separate local collections for products, sales, customers, payment methods, held orders, printers, print jobs, restaurant tables, service users, product batches, tax rates, orders, refunds, waybill jobs, scrap purchase jobs, and sync jobs.
- Feature repositories that frequently select IndexedDB or SQLite themselves using `hasNativeDatabase`.
- Storage scopes based on user and tenant, but no centralized role-aware database manifest.

This goal replaces platform branching inside feature repositories with adapters behind shared contracts. It must preserve current native data and migrate current browser data safely.

## Architectural Decisions

1. **UI reads local data.** Screens and domain logic do not query GraphQL directly for data that must work offline.
2. **Repositories are platform-neutral.** UI, hooks, domain services, and the sync engine depend on repository interfaces only.
3. **Platform selection happens once.** A composition root chooses `IndexedDbLocalDatabase` on web and `SqliteLocalDatabase` on native.
4. **Collections remain explicit.** Do not introduce a catch-all entity or JSON document table. Each server collection has a SQLite table and a Dexie table/object store.
5. **Role controls provisioning and sync.** A role manifest selects the required collections, pull queries, repositories, and retention policy.
6. **Tenant isolation is mandatory.** Every persisted business record is scoped at least by tenant and, where applicable, store, device, user, and counter.
7. **Money is stored as integer minor units.** Dates use a single documented representation on both adapters.
8. **Writes are durable before UI state is cleared.** Sales, payments, refunds, cash movements, transfers, and other mutations enter a local transaction and outbox first.
9. **Sync semantics are identical on both platforms.** Offline IDs, idempotency keys, dependency ordering, retry state, tombstones, cursors, and conflicts have the same meaning.
10. **Role changes trigger reconciliation.** After a role or tenant change, cancel active sync, close the old scope, purge collections no longer permitted, provision the new manifest, then pull fresh data.

## Target Source Layout

The existing one-file-per-collection Drizzle schemas remain valid. Contracts and platform adapters live in `packages/database`, keeping persistence code out of the app.

```text
packages/database/src/runtime/
├── index.ts
├── LocalDatabase.ts
├── DatabaseProvider.tsx
├── roleManifest.ts
├── scope.ts
├── schema/
│   └── <one Drizzle schema per collection>
├── repositories/
│   ├── CatalogRepository.ts
│   ├── CustomerRepository.ts
│   ├── InventoryRepository.ts
│   ├── SaleRepository.ts
│   ├── PaymentRepository.ts
│   ├── ShiftRepository.ts
│   ├── OrderRepository.ts
│   ├── SettingsRepository.ts
│   └── SyncRepository.ts
└── adapters/
    ├── sqlite/
    │   ├── sqlite.client.ts
    │   ├── sqlite.database.ts
    │   └── repositories/
    └── indexeddb/
        ├── indexeddb.client.ts
        ├── indexeddb.database.ts
        ├── indexeddb.migrations.ts
        └── repositories/
```

Use `.web.ts` / `.native.ts` module resolution or one composition root so browser bundles never import `expo-sqlite` and native bundles never require Dexie.

## Shared Contract

The final contract should expose domain repositories, lifecycle operations, and transactions. It must not leak Drizzle, SQLite, Dexie, `IDBObjectStore`, or platform checks.

```ts
export type PosRole = 'cashier' | 'manager' | 'admin' | 'owner' | 'superadmin';

export interface DatabaseScope {
    tenantId: string;
    userId: string;
    role: PosRole;
    storeIds: readonly string[];
    deviceId: string;
    counterId?: string;
}

export interface LocalDatabase {
    catalog: CatalogRepository;
    customers: CustomerRepository;
    inventory: InventoryRepository;
    sales: SaleRepository;
    payments: PaymentRepository;
    shifts: ShiftRepository;
    orders: OrderRepository;
    settings: SettingsRepository;
    sync: SyncRepository;

    initialize(scope: DatabaseScope): Promise<void>;
    reconcileRole(previous: DatabaseScope | undefined, next: DatabaseScope): Promise<void>;
    transaction<T>(work: (tx: LocalDatabaseTransaction) => Promise<T>): Promise<T>;
    close(): Promise<void>;
}
```

Repository methods accept or are constructed with a validated `DatabaseScope`. Arbitrary scope strings from screens are not permitted.

## Complete Local Collection Set

### Core and access

- `organizations`: current tenant identity and sync metadata.
- `stores`: permitted store summaries.
- `devices`: current device registration and capabilities.
- `counters`: permitted checkout counters.
- `users`: current user plus only operationally necessary staff summaries.
- `role_permissions`: effective server-issued permissions/capabilities; never a locally editable authority source.
- `app_settings`: tenant/store/device/user settings with precedence metadata.
- `feature_flags`: locally cached server feature availability.

### Catalog and pricing

- `categories`
- `brands`
- `products`
- `product_barcodes`
- `product_uoms`
- `product_prices`
- `price_lists`
- `tax_rates`
- `product_batches` for pharmacy/lot-controlled stock
- `product_modifiers` and `modifier_groups` for restaurant/customization flows
- `service_users` for service assignments

### Inventory and purchasing

- `stock_locations`
- `stock_balances`
- `stock_movements` for locally initiated pending movements and the retained operational window
- `stock_counts` and `stock_count_lines`
- `transfers` and `transfer_lines`
- `suppliers`
- `purchase_orders` and `purchase_order_lines`
- `goods_receipts` and `goods_receipt_lines`
- `scrap_purchase_jobs`
- `waybill_jobs`

### Customers

- `customers`
- `customer_addresses`
- `customer_credit_summaries` where permitted
- `customer_loyalty_summaries` where enabled

### Sales, payments, and returns

- `carts` and `cart_lines` for durable active carts
- `held_orders` and `held_order_lines`
- `sales` and `sale_lines`
- `payments`
- `payment_methods`
- `refunds` and `refund_lines`
- `orders` for the role-appropriate history window
- `restaurant_tables`
- `prescription_contexts` when pharmacy mode is enabled
- `serialized_item_assignments` when electronics/serial tracking is enabled

### Shifts and cash

- `shifts`
- `cash_drawers`
- `cash_transactions`
- `currency_denominations`
- `expense_categories`
- `expenses`

### Printing

- `printers`
- `print_templates`
- `print_jobs`

### Sync and operations

- `sync_outbox`: every pending mutation with stable offline ID and idempotency key.
- `sync_dependencies`: ordering between jobs such as scrap purchase -> sale -> waybill.
- `sync_state`: pull cursor and last successful sync per collection and scope.
- `sync_conflicts`: unresolved version conflicts and safe resolution metadata.
- `sync_errors`: durable diagnostic history with bounded retention.
- `tombstones`: server deletions retained until every required local projection is reconciled.
- `schema_metadata`: adapter schema version and data migration state.

Existing payload-based tables may be migrated incrementally. High-volume/query-critical entities (`products`, `stock_balances`, `sales`, `sale_lines`, `payments`, `sync_outbox`) should use typed columns first; opaque payload fields may remain temporarily for low-query reference collections.

## Role Data Manifest

Legend: `RW` local creation/update plus sync, `R` local read cache, `S` summary/limited window, `-` not provisioned.

| Data group                           | Cashier                       | Manager           | Admin              | Owner             | Superadmin                                         |
| ------------------------------------ | ----------------------------- | ----------------- | ------------------ | ----------------- | -------------------------------------------------- |
| Current tenant/store/device/counter  | R                             | R                 | R                  | R                 | R                                                  |
| Own effective permissions/settings   | R                             | R                 | R                  | R                 | R                                                  |
| Catalog/prices/taxes/payment methods | R                             | R                 | R                  | R                 | R                                                  |
| Current-store stock balance          | R                             | RW                | RW                 | R                 | R                                                  |
| Other permitted stores' stock        | -                             | S                 | RW                 | R                 | R                                                  |
| Customers                            | RW, bounded                   | RW                | RW                 | R                 | R                                                  |
| Active carts/held orders             | RW own/current counter        | RW store          | RW stores          | R                 | R                                                  |
| Sales/payments/refunds               | RW own shift; bounded history | RW store          | RW stores          | R/S               | R/S                                                |
| Shifts/cash/expenses                 | RW own shift                  | RW store          | RW stores          | R/S               | R/S                                                |
| Transfers/counts                     | - or request only             | RW store          | RW stores          | R/S               | R/S                                                |
| Purchasing/suppliers                 | -                             | S or approval     | RW                 | R/S               | R/S                                                |
| Staff summaries                      | operational only              | store team        | tenant team        | R/S               | R/S                                                |
| Reports                              | own shift summary             | store summary     | tenant operational | tenant summary    | cross-tenant summary only when explicitly selected |
| Tenant configuration                 | -                             | limited R         | RW                 | RW governance     | RW platform governance                             |
| Sync/print operational tables        | RW current device             | RW current device | RW current device  | RW current device | RW current device                                  |

The manifest is capability-driven beneath the named role. Named roles provide defaults, while the API-provided effective permission set can only reduce or explicitly extend those defaults. `superadmin` must not cause all tenants to be downloaded: it receives data only for the tenant/store context explicitly selected for the current session.

Suggested retention defaults:

- Cashier: active shift, open/held carts, and recent completed sales needed for permitted returns.
- Manager: current store plus an operational history window.
- Admin: assigned stores plus a larger operational history window.
- Owner: summaries by default; detailed data is pulled on demand for selected stores/date ranges.
- Superadmin: metadata and summaries by default; tenant details are isolated and pulled only after explicit tenant selection.

Exact history windows and capabilities must be server-configurable and returned during bootstrap.

## Role-Aware Provisioning Flow

1. Authenticate online and verify tenant membership, role, effective permissions, allowed stores, device, and counter.
2. Build a canonical `DatabaseScope`; include tenant, user, role, selected stores, device, and schema generation in its identity.
3. Open the platform adapter and run forward-only schema migrations.
4. Load the role manifest and enable only required repositories/pull collections.
5. Purge stale data outside the new tenant/store/role boundary in one transaction. Never purge unsynced mutations; quarantine them and require reconciliation.
6. Pull bootstrap data in dependency order: core -> settings -> catalog -> pricing/tax -> inventory -> customers -> operational transactions.
7. Persist each page and its cursor atomically.
8. Expose local data to the UI as soon as the minimum bootstrap set is ready; continue optional pulls asynchronously.
9. Push the outbox in dependency order and apply acknowledgements atomically.
10. On logout, close the database and apply the configured data policy. Shared-device mode should purge synced user-scoped data while retaining only permitted tenant/device reference caches.

SQLite tables are created by migrations, not dynamically per role. “Role-created database” means logical provisioning and retention of allowed rows/collections, not divergent physical schemas. Dexie stores likewise use one versioned schema; the manifest controls population and access. This prevents migration fragmentation when a user's role changes.

## IndexedDB / Dexie Design

- Add `dexie` and `dexie-react-hooks` to the mobile workspace dependencies used by web builds.
- Define every object store in a versioned `Dexie` subclass.
- Use compound indexes that match native access paths, such as `[tenantId+storeId]`, `[scopeKey+status]`, `[scopeKey+updatedAt]`, and unique scoped remote/offline IDs.
- Implement real multi-store Dexie transactions for sale + lines + payments + outbox and other business invariants.
- Replace raw IndexedDB helpers in `webClient.ts` only after adapter parity exists.
- Migrate database `indyz-pos-web` data from the current stores into the Dexie schema. Migration must be idempotent and retain failed/pending jobs.
- Provide observable repository queries. React hooks may use `useLiveQuery`, but `dexie-react-hooks` must remain in the web hook boundary rather than repository contracts.
- Add a development-only reset/inspect command guarded from production web builds.

## SQLite / Drizzle Design

- Preserve `indyz-pos.db` and existing forward-only migrations.
- Enable Expo SQLite change listeners before adopting Drizzle live queries.
- Move current native branches into SQLite repository implementations without changing persisted identifiers or queue semantics.
- Add normalized tables through checked-in Drizzle migrations; keep runtime initialization compatible with existing installations.
- Use SQLite transactions for every aggregate write.
- Add indexes equivalent to the Dexie indexes used by shared repository queries.

## Sync Requirements

- One collection registry defines pull order, dependencies, role/capability requirement, page size, cursor name, and retention policy.
- Every local mutation has `offlineId`, `idempotencyKey`, `entityType`, `operation`, `scopeKey`, `payload`, `baseServerVersion`, `status`, `attemptCount`, `nextAttemptAt`, `createdAt`, and `updatedAt`.
- Statuses are consistent across adapters: `PENDING`, `RUNNING`, `FAILED`, `CONFLICT`, `COMPLETED`.
- A crashed `RUNNING` job returns to `PENDING` after a lease expires.
- Push uses stable idempotency keys on every retry.
- Pull writes records, tombstones, and cursor in one transaction per page.
- Conflict rules are defined per entity; financial transactions are append-only and never silently last-write-wins.
- Sync never uploads data from a prior tenant or user scope after account switching.

## Delivery Plan

### Phase 1 — Contracts and characterization

- Inventory current repository methods and storage shapes.
- Add shared record, scope, transaction, and repository contracts.
- Add adapter conformance tests and characterize current SQLite/IndexedDB behavior.
- Centralize role normalization and the role/capability manifest.

### Phase 2 — Dexie foundation

- Install Dexie packages.
- Create the versioned web database and migration from current raw IndexedDB stores.
- Implement IndexedDB repositories and transactions for existing collections.
- Add live-query hooks at the web presentation boundary.

### Phase 3 — SQLite adapter extraction

- Move Drizzle operations from feature repositories into SQLite adapter repositories.
- Preserve existing database name, migrations, IDs, scope behavior, and outbox records.
- Enable change listeners and add native observable queries where useful.

### Phase 4 — Composition and feature migration

- Add a platform-specific composition root returning `LocalDatabase`.
- Inject the active database through `DatabaseProvider`.
- Migrate features one vertical slice at a time: catalog/billing -> sales/payments -> customers -> inventory -> shifts -> orders/refunds -> printing/logistics.
- Remove `Platform`, `hasNativeDatabase`, raw IndexedDB, and Drizzle imports from screens, hooks, domain modules, and feature-level repository contracts.

### Phase 5 — Role provisioning and sync parity

- Make bootstrap and collection pulls manifest-driven.
- Add role/tenant/store transition reconciliation and retention enforcement.
- Run the same sync behavior tests against both adapters.
- Verify all five roles with offline create, restart, retry, conflict, logout, and role-change scenarios.

### Phase 6 — Cleanup and documentation

- Remove legacy web helpers only after migration telemetry/tests show parity.
- Document adding a collection to both schemas, adapters, manifest, sync registry, and tests.
- Document that IndexedDB is development-only and prevent accidental production web enablement.

## Acceptance Criteria

- Android and iOS open `indyz-pos.db` through Expo SQLite + Drizzle and pass existing-data migration tests.
- Web development opens the Dexie IndexedDB database without bundling or invoking Expo SQLite.
- No screen or business/domain module imports Dexie, Expo SQLite, Drizzle, `Platform`, `hasNativeDatabase`, or raw IndexedDB APIs to choose persistence.
- Shared repository conformance tests pass unchanged against in-memory/test instances of both adapters.
- A checkout atomically persists sale, sale lines, payments, stock effects, print intent, and outbox work before the cart is cleared.
- Offline mutations survive reload/restart and sync with the same offline ID after reconnection.
- Pending and failed mutations survive the raw IndexedDB-to-Dexie migration.
- Each role receives only manifest-permitted collections, stores, rows, and history windows.
- Changing from a broader role to a narrower role removes disallowed synced data but preserves/quarantines unsynced work.
- Switching tenants cannot expose records, live-query results, queued mutations, or cursors from another tenant.
- Owner and superadmin sessions do not automatically replicate organization-wide or cross-tenant detail.
- Collection pull cursors advance only in the same transaction that commits the pulled page.
- SQLite and Dexie return equivalent ordering, filtering, status transitions, and transaction outcomes.
- TypeScript, mobile tests, adapter conformance tests, migration tests, and `git diff --check` pass.

## Non-Goals

- Supporting a production browser POS database.
- Replacing GraphQL or redesigning the server database.
- Treating locally cached permissions as authoritative authorization.
- Downloading the complete server dataset for owner or superadmin roles.
- Maintaining two independent domain models for SQLite and IndexedDB.
- Dynamically creating or dropping physical tables based on the signed-in role.

## Risks and Controls

- **Current uncommitted database work:** implement in small isolated commits and do not rewrite unrelated schema changes.
- **Data loss during web migration:** copy first, validate counts and pending jobs, mark migration complete, and delete legacy stores only in a later version.
- **Adapter behavior drift:** require a shared conformance suite for filters, ordering, transactions, and failures.
- **Role leakage:** require `DatabaseScope` at adapter construction, compound scope indexes, repository-level predicates, and role-transition purge tests.
- **Oversized privileged caches:** use summaries and on-demand scoped pulls instead of role-wide replication.
- **Partial financial writes:** make aggregate writes transactional and keep immutable outbox payloads.
- **Schema divergence:** use one collection registry and a checklist that requires both adapter schemas and migrations for every new collection.

## Definition of Done

The goal is complete when the same POS screens and business logic operate offline on native SQLite and development-web IndexedDB through the same repository interfaces; the sync engine behaves identically on both; current data migrates safely; and automated tests prove tenant, store, user, and role isolation for cashier, manager, admin, owner, and superadmin.
