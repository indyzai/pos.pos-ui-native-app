# Native platform implementation status

The comprehensive platform specification is the target, not the current completion status. This repository has two native apps; no web application was added.

## Implemented in this change

- Flattened existing feature packages into `packages/feature-*`; authentication moved to `feature-auth` with its existing package import name preserved.
- Extracted shared billing types/calculations, refund policy, inventory reconciliation, purchase split rules, organization rules, and printer selection. Both apps import these implementations through compatibility exports.
- Extracted billing/reference/held-order/batch, orders, printer/job, restaurant, scrap, and logistics repositories into shared feature packages. Catalog API mapping is shared too; this is not yet complete removal of app-owned business logic.
- Shared orders application service now paginates the complete bill list, preserves pending refunds, rejects malformed responses, and prevents late responses from writing after a workspace/session change. Each app supplies its own request and storage scope.
- Shared printer application service reads cached configuration first, retains other counter assignments during refresh, and distinguishes server-submitted jobs from physically completed jobs. Submitted jobs are polled rather than submitted again.
- Extracted atomic local mutation/outbox enqueueing and dependency-ID resolution from `createLocalFirstTableHook` into reusable application-facing functions. Tests cover transaction rollback and dependent sale ID replacement.
- Customer creation now uses the shared durable outbox, with customer-to-sale dependency resolution before bill submission. Customer refresh uses paginated GraphQL calls and preserves unsynced records. Consecutive local edits acquire dependencies; older acknowledgements preserve newer edits.
- Both apps use a shared purchase service for paginated refresh and outbox create/update processing. Screen saves no longer call the purchase mutation directly; Admin has an online purchase worker and manual sync includes purchases. Tax rates and units round-trip through the API.
- Shared report calculations respect cashier-visible sale scope and organization timezone. Refunds count in their own reporting period even when the original visible sale is older; invalid timezone settings fall back to UTC.
- Hardened financial calculations: line discounts cannot exceed line value, duplicate product refund selections are rejected, and purchase allocation preserves every cent.
- POS accepts cashier/manager and higher roles capped at manager permissions, as clarified by the user. Admin accepts admin/owner/superadmin only. Session authentication is granted only after app access and tenant resolution succeed.
- Granular permission defaults with global, organization, and user policy layers. Global/organization denials are ceilings. POS never receives administrative management permissions; Admin never receives cashier bill creation permission. Billing discounts, inventory editing, and purchase editing use the shared permission hook.
- Shared business profiles for the requested business types, legacy settings compatibility, global disable precedence, organization flags, business scope, and effective date windows. Both apps share scheduled flag evaluation and navigation filtering. POS bootstrap selection uses effective flags.
- Shared sale outbox worker with injected synchronization and connectivity, locking before asynchronous queue reads, exponential retry for incomplete progress, and focused concurrency/offline tests.
- Printer profiles, drivers, templates, organization/branch-isolated routing, copy handling, and validated multi-column label coordinates. These are platform-neutral primitives; hardware drivers are not yet implemented or connected to the receipt UI.
- Strict package TypeScript checking plus both app checks.

## Latest implementation work (2026-09-23)

- Removed cross-app source imports. Purchases, inventory screens/hooks/dialogs, receipt presentation, product icons and scanner UI now live in shared feature/native packages, with compatibility exports in the apps.
- Both inventory screens now receive their own app's API adapter and storage scope; Admin no longer accidentally uses the POS inventory API implementation.
- Inventory categories, units and tax references are read through local collections. API refresh persists these collections before returning data, with cached fallback and protection against late workspace responses.
- Added native multiple-image purchase uploads using the Expo SDK-matched image picker. AI import is an application service, validates extracted items, matches existing products and rejects results after a workspace switch. Screens no longer make purchase/AI HTTP requests directly.
- Added focused AI import regression tests. Per the user's latest instruction, no builds or type checks were run for these latest changes; earlier verification results below do not cover this section.

## Existing APIs inspected and to reuse

Source: sibling `pos.pos-api-svc/src/modules`. The user subsequently authorized changes in this repository too.

| Capability   | Existing operations                                                                                                                     |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| Offline sync | REST `sync/bootstrap`, `sync/batch`, `sync/has-updates`                                                                                 |
| Settings     | `getAllSettings`, `updateAllSettings`                                                                                                   |
| Printers     | `counterPrinters`, `counterPrinter`, `createCounterPrinter`, `updateCounterPrinter`, `setDefaultCounterPrinter`, `deleteCounterPrinter` |
| Print jobs   | `printerJobs`, `createPrinterJob`, `completePrinterJob`, `failPrinterJob`                                                               |
| Scrap        | `recordScrapPurchase`, `recordScrapSale`, `getAvailableScrapPurchases`, `getScrapBill`, `getScrapInventory`                             |
| Finance      | `financeAccounts`, `ledger`, `balanceSheet`, `profitLoss`, `gstSummary`, `paymentTracking`, reconciliation and journal mutations        |

No duplicate endpoints or speculative `syncChanges` / `pushChanges` GraphQL calls were created.

## Required before production completion

- Finish moving the remaining app-owned repositories, API mappings, and business logic into shared packages. Cross-app screen imports have been removed.
- Complete feature implementations for catalog, customers, suppliers, payments, returns, scrap, services, restaurant, pharmacy, shifts, expenses, and notifications. Existing extracted repositories or package scaffolds do not mean those workflows are complete.
- Wire server-issued permission and global feature policies through local persistence, all application services, database data requirements, and backend authorization. The policy resolver currently consumes `organization.settings.permissionPolicy`; server delivery and enforcement need integration verification.
- Implement or complete Admin dashboards, organization/branch/counter/user workflows, pricing, suppliers, approvals, finance screens, alerts, and multi-branch views.
- Complete split/partial payments, provider adapters, store credit, service charging rules, scrap lifecycle/excess-value settlement, manager authorization, and shift workflows.
- Complete incremental cursor synchronization, conflict resolution, OS background execution, and mutation handlers beyond the sale/customer/purchase workflows implemented here.
- Implement native printer discovery/transports, receipt/barcode rendering, printer management screens, durable hardware print jobs, and physical-device validation. Server job acknowledgement is not proof that a receipt printed.
- Integrate Zustand, Zod, and GraphQL Code Generator with the verified schema and the completed shared services.
- Run native iOS/Android integration tests, offline restart/recovery tests, tenant isolation tests, migration tests, API permission tests, and physical printer tests.

Production readiness cannot be inferred from TypeScript and unit tests alone. This change is a tested architecture and policy increment, not completion of the entire supplied specification.

## Backend changes and rollout requirements

- Added transaction-scoped idempotency receipts for customer and purchase creation. Replays return the previous result; reusing a key with different data returns a conflict.
- Extended the existing `savePurchase` input with an edit ID and client mutation ID instead of adding a duplicate endpoint. Only administrative roles may edit, and only drafts are editable.
- New purchase drafts do not increase stock. Completion posts stock and accounting entries atomically; cancelling completed purchases is rejected in favor of a return workflow.
- Added nullable stock-posting metadata and per-item tax/unit fields, with PostgreSQL and Oracle migrations. Existing historical stock state is left unknown, not bulk-backfilled. Historical drafts require reconciliation before editing/completing/cancelling.
- Deploy the API and apply the reviewed migration before deploying these app changes. No production migration or deployment has been run. Review historical draft stock against the stock ledger before approving any backfill.

## Completion checklist and next implementation order

| Area                      | Current status                                                            | Remaining work                                                                                           |
| ------------------------- | ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Native monorepo           | Shared feature layout implemented; no web app added                       | Remove remaining duplicated services and cross-app screen imports                                        |
| Authentication and access | App role admission enforced; shared permission resolver implemented       | Verify refresh/device/PIN/biometric flows, manager authorization, and server-side enforcement            |
| Feature configuration     | Profiles, effective flags, date windows, navigation filtering implemented | Server-managed policy delivery, management UI, and complete feature-driven database provisioning         |
| Billing                   | Local-first sale flow and offline customer dependencies implemented       | Full pricing/promotion/payment workflows                                                                 |
| Local-first mutations     | Generic hook, dependency chaining and newer-edit preservation implemented | Migrate remaining direct API writes and verify native transaction races                                  |
| Background sync           | Sale/customer/purchase processing with online gating and retry            | Remaining entity handlers, durable OS background execution, cursor/conflict coverage                     |
| Orders and returns        | Shared paginated orders/refund service implemented                        | Exchange/store-credit/refund-provider and approval workflows                                             |
| Inventory and purchasing  | Existing shared screens and extracted domain/repositories                 | Purchase update sync, full receiving/returns/approval lifecycle, remaining transfer/stock workflows      |
| Reports                   | Shared scoped and timezone-aware sales metrics implemented                | Full requested report catalogue, export, finance and multi-branch integration                            |
| Business-specific modes   | Shared profiles and existing domain logic extracted                       | Complete restaurant, pharmacy, wholesale, electronics, service and scrap workflows                       |
| Admin management          | Existing screens retained; role separation enforced                       | Complete organization/branch/counter/users, suppliers, pricing, approvals, finance, alerts               |
| Printing                  | Shared routing/driver contracts and server job tracking implemented       | Native transports, discovery, templates/labels, management UI and hardware tests                         |
| Required tooling          | Strict TypeScript and package checks implemented                          | Zustand, Zod and schema-backed GraphQL generation integration                                            |
| Release validation        | Unit/type checks and both Android bundle exports pass                     | iOS builds, device integration, offline recovery, migrations, tenant/API authorization and printer tests |

### Known sync contract gaps

- Customer and purchase writes now have durable outbox handlers and server idempotency support. Their new contract and migrations require coordinated API deployment and real-database integration tests.
- Printer create-job requests lack server-side idempotency in the inspected implementation. Polling acknowledged jobs prevents routine resubmission, but a lost create response can still lead to duplicates on retry.
- These gaps must be closed before describing either app as completely offline-capable or production-ready.

### Verification (2026-09-22)

- Package and both app TypeScript checks pass.
- Both POS and Admin Android Expo exports completed successfully. This validates bundling, not on-device behavior or a signed release build.
- The local Expo runtime warned that Node 20.17.0 is below its supported minimum of 20.19.4; upgrade the build environment before release.
- No backend deployment or physical printer validation was performed.
