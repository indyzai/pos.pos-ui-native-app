# Billing API and offline sales

The default POS endpoint is `https://api.indyzai.com/pos/api/graphql`, matching pos.pos-ui-new. To use another environment, set `EXPO_PUBLIC_POS_API_URL` to the same full GraphQL URL as `NEXT_PUBLIC_API_POS_URL` in pos.pos-ui-new and restart Expo. On a phone, localhost refers to the phone: use an accessible LAN or HTTPS server URL.

Billing sends the signed-in access token and selected business in `x-tenant-id`. Products (including category/tax) are paginated from GraphQL. Branches, counters, settings, and the active counter session come from the organization bootstrap. The shared header shows the selected branch/counter and opens the first available counter when its Closed status is pressed.

The catalog, session, sale history, and sale outbox are stored in Drizzle-managed Expo SQLite tables, isolated by user and tenant. TanStack Query owns in-memory billing cache invalidation and refresh state. Connect once and refresh before working offline. Checkout persists an immutable bill before clearing the cart. Upload uses the reference `saveBill(NewBillInput)` contract and keeps the same `offlineId` on every retry. The POS backend must retain its tenant-scoped offlineId deduplication. Failed bills stay queued, with errors shown in billing. Catalog refresh and queued-sale uploads run only when the user presses Refresh. Opening Billing reads the local cache; checkout only saves locally. This is not background sync while the app is closed.

Card/UPI selection records a payment already collected externally; it is not a payment gateway. When `features.requireOpenCounterForBilling` (or the compatible `requireCounterSessionForBilling`) is enabled, checkout is disabled and the billing service rejects bill creation unless the organization bootstrap has an OPEN session. This protection defaults to enabled. A cached session can be closed remotely while offline; rejected bills remain queued and require operator reconciliation. Do not clear app data or uninstall while bills are pending. Expo SQLite data is durable local storage, not encrypted credential storage. Cart drafts are not persisted.

Native builds use Expo SQLite with Drizzle ORM. The billing schema is created idempotently during database initialization and includes indexes for tenant-scoped catalog and queue reads. Add an explicit migration before changing an existing column or deleting data.

The web build uses IndexedDB because Expo SQLite can require `SharedArrayBuffer` in a browser. It persists the same scoped billing snapshot across reloads, but native-device verification remains required before rollout.

Verification checklist: load online; disconnect; save a sale; restart and confirm pending count; reconnect and confirm one server bill; retry a failed upload; switch business and confirm data isolation; expire the token and confirm the queue survives. Real-device and authenticated-server verification is required before rollout.
