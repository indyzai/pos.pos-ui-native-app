# Offline-first business APIs

Business reads use SQLite on native devices and IndexedDB in browsers. Business writes return after saving the local projection and its replay command. A returned pending job means **saved locally**, not accepted by the server.

## Native POS and Admin

- Existing customers, purchases, settings, printers, and sales retain their typed outboxes.
- Inventory products, reconciliation reports, counter opens/closes, cash entries, staff creation, and remote receipt jobs use `queueApiMutation` and `sync_outbox`.
- Entity hooks, including refunds, retain `sync_mutations`. The app worker drains both queues; a screen does not need to remain mounted.
- Related stock projections and the outbox command are written in one transaction. Server acknowledgements preserve newer local edits.
- Replay uses the current session. Authentication tokens are never saved in commands. Replay-only request fields are removed after acknowledgement.
- Creates resolve dependent local IDs before subsequent updates, sales, or counter closes. Numeric server IDs are converted at the network boundary.
- Jobs retain their idempotency key across failures and stop automatic retry after three failures. `retryApiMutation(database, jobId)` resets a failed command without changing its key.
- SQLite migration 0005 / runtime schema version 8 adds dedicated cash-entry and denomination tables. Browser schema version 130 is shared by both vendored clients.

## Web

The public business API routes reads and writes to local services. `SyncManager` alone replays queued server writes and performs background pulls. Branch and tax-type creation also follow this flow. Storage failures reject enqueueing; they cannot report a successfully queued command.

Tax types have their own IndexedDB store. Route refresh for `/tax-rates` hydrates it while preserving pending local mutations.

## Network-dependent operations

Login, registration, token renewal, PIN verification, workspace provisioning, and first-time organization bootstrap require server acknowledgement to establish access. Background refresh methods intentionally access the server, then update local projections. Hardware printing uses its existing durable native delivery service.

## Deployment and libraries

Deploy the POS API change before releasing the native clients: queued cash entries now supply `MiscellaneousTransactionInput.clientMutationId`, and the backend commits the financial transaction and receipt together. Existing callers may omit this optional field.

Redux Toolkit can manage shared application state in React web and React Native. Keep TanStack Query for loading/refresh state and the durable database/outbox for business data. The web app already uses Zustand; replacing it with Redux is a separate migration and is not required for reliable offline sync.
