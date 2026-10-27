# POS offline sync validation

Validation date: 2026-10-27. Scope: POS mobile application, its vendored shared sync engine, native sync adapters, offline storage, feature outboxes, and incoming refresh logic.

## Fixes

- Resolve acknowledged product and counter IDs before legacy bill replay checks for unresolved references.
- Link checkout's stock and counter projections to its queued bill. Product/counter acknowledgements preserve newer offline stock deductions and totals while bills remain pending or failed.
- Defer interrupted delivery without spending retries when connectivity is confirmed offline. Recheck connectivity after obtaining credentials and before dispatch.
- Reject already-aborted HTTP requests before transport dispatch.
- Commit petty-cash entries and their local counter totals together. Closing a counter waits for pending cash entries and bills.
- Retain scrap product masters in the products cache and read the scrap selector from local storage.
- Find quick-added products by their stable local record ID even when their server ID arrives during catalog reload.
- Create POS receipt jobs on the device with saved receipt content before hardware access. Local delivery preserves the UI job ID and never submits new receipt jobs to the backend. Connection failures retain the document; interrupted writes are marked uncertain.

No database schema changes are required. Changes to shared code are inside the existing `vendor/pos-ui-shared` checkout.

## Automated coverage

| Area                          | Verified behavior                                                                                                                                                             |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Billing                       | Durable checkout before cart clearing; atomic stock, counter and financial projections; stable offline receipt and replay IDs; retained failed bills; quick-add ID resolution |
| Dependencies                  | Product/customer/counter creates precede dependent writes; counter close follows bills and cash entries; acknowledged server IDs replace reference fields                     |
| Recovery                      | Reopen/restart, expired worker leases, lost responses, concurrent triggers, three-failure limits, manual retry retaining idempotency keys                                     |
| Connectivity and cancellation | No claiming while offline; connection loss during replay; loss before dispatch; aborted requests; refresh recovery                                                            |
| Isolation                     | Tenant/user changes, stale acknowledgements, role-based collections and retained jobs                                                                                         |
| Storage                       | Transaction rollback, disk-write failures, migration re-entry, retained historical queues, IndexedDB and SQLite schema checks                                                 |
| Refresh                       | Pending/failed local work survives incoming data; revision markers and projections commit together; product batch overlays                                                    |
| Other feature queues          | Customers, purchases, inventory/reconciliation, settings, printers, operations, refunds, waybills and scrap                                                                   |
| Business context              | Restaurant modifiers, pharmacy prescriptions, electronics metadata, wholesale pricing, payment context and receipt data                                                       |

Commands:

- `bun test --isolate`: 587 passing tests, no failures. Includes the loopback TCP printer transport test, run with local-network sandbox access.
- `bun run typecheck`: POS and Admin TypeScript checks pass.
- Prettier checks for changed files and `git diff --check` in both checkouts pass.

## Device and server validation still required

Automated tests exercise local adapters and simulated server responses. They do not establish end-to-end behavior on Android/iOS or against the deployed POS API.

Before release, use a test business with a completed initial download:

1. Enable airplane mode, open a counter, quick-add items, create a customer, record cash income/expense, and bill with normal and customized lines. Confirm local receipts, stock and counter totals.
2. Kill and relaunch the app while offline; verify saved work and pending jobs remain. Close the counter offline.
3. Reconnect and interrupt connectivity during replay. Verify final server IDs, one server bill per offline ID, correct stock/totals, and dependency ordering.
4. Force a server validation failure and retry it after correction. Verify unrelated jobs progress and the failed input remains available.
5. Exercise tenant switching during a pending request and confirm business data remains isolated.
6. Check actual printer hardware delivery and the installed Expo SQLite driver during app termination/relaunch.

Offline use requires previously saved organization/catalog/reference data. First login, provisioning, token renewal and server-only analysis still require connectivity. Scrap masters become available offline after a successful products refresh with this version. Physical card/UPI settlement requires its payment provider; queueing a bill does not verify settlement.
