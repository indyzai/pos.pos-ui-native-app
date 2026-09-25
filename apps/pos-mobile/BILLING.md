# Billing API and offline sales

The default POS endpoint is `https://api.indyzai.com/pos/api/graphql`, matching pos.pos-ui-new. To use another environment, set `EXPO_PUBLIC_POS_API_URL` to the same full GraphQL URL as `NEXT_PUBLIC_API_POS_URL` in pos.pos-ui-new and restart Expo. On a phone, localhost refers to the phone: use an accessible LAN or HTTPS server URL.

Billing sends the signed-in access token and selected business in `x-tenant-id`. Products (including category/tax) are paginated from GraphQL. Branches, counters, settings, and the active counter session come from the organization bootstrap. The shared header shows the selected branch/counter and opens the first available counter when its Closed status is pressed.

The catalog, tax rates, customers, payment methods, technicians, pharmacy batches, restaurant tables, session, sale history, and outbound jobs are stored in separate Drizzle-managed Expo SQLite tables, isolated by user and tenant. TanStack Query owns in-memory cache invalidation and refresh state. Connect once and pull down before working offline. Checkout persists an immutable bill before clearing the cart. Upload uses the reference `saveBill(NewBillInput)` contract and keeps the same `offlineId` on every retry. The POS backend must retain its tenant-scoped offlineId deduplication. Failed bills stay queued, with errors shown in billing. Catalog refresh and queued uploads run only on an explicit pull-to-refresh/manual refresh. Ordinary grid scrolling cannot trigger refresh. Opening Billing reads the local cache; checkout only saves locally. This is not background sync while the app is closed.

Card/UPI selection records a payment already collected externally; it is not a payment gateway. When `features.requireOpenCounterForBilling` (or the compatible `requireCounterSessionForBilling`) is enabled, checkout is disabled and the billing service rejects bill creation unless the organization bootstrap has an OPEN session. This protection defaults to enabled. A cached session can be closed remotely while offline; rejected bills remain queued and require operator reconciliation. Do not clear app data or uninstall while bills are pending. Expo SQLite data is durable local storage, not encrypted credential storage. Cart drafts are not persisted.

Native builds use Expo SQLite with Drizzle ORM. Web resolves `@indyzai/pos-database/client`, which keeps SQLite out of the web path, and stores the equivalent scoped collections in IndexedDB. The billing schema is created idempotently during database initialization and includes indexes for tenant-scoped catalog and queue reads. Add an explicit forward-only migration for every schema change in `packages/database`.

Scrap exchange uses a dependent queue: first create a DRAFT `recordScrapPurchase` with a stable client-generated bill ID, then submit the sale with a `SCRAP` payment referencing that ID. A failed scrap purchase prevents the linked sale from uploading. Waybill creation similarly waits for a server invoice before its durable logistics job is materialized. Refunds use stable offline IDs, item-level quantities, proportional tax, and over-refund protection.

Business-specific cart metadata is retained through held orders, sale details, receipts, and retry: restaurant mode/table/modifiers, pharmacy batch/prescription/doctor, service technician/parts/warranty, electronics serial or IMEI, wholesale tier and waybill data, and scrap exchange. Tax choices come from the organization `taxes` API; never restore a hardcoded percentage list.

Verification checklist: load online; disconnect; save a sale; restart and confirm pending count; reconnect and confirm one server bill; retry a failed upload; switch business and confirm data isolation; expire the token and confirm the queue survives. Real-device and authenticated-server verification is required before rollout.

## `pos.pos-ui-new` parity audit

| Reference capability                             | Native implementation                                                     |
| ------------------------------------------------ | ------------------------------------------------------------------------- |
| Search, clear, scan, category filters, quick add | Responsive catalog toolbar and product grid                               |
| Branch/counter selection and session state       | Shared application header and counter-session dialogs                     |
| Cart drawer/FAB, fixed summary, swipe removal    | Bottom-nav cart on phones and right-pane FAB/cart on wide screens         |
| Customer selection and creation                  | Cached customer picker with API creation                                  |
| Item/order discounts and line tax selection      | Cart controls using organization settings and configured tax records      |
| Cash, UPI, card, bank account, reference, change | Checkout dialog with configured payment methods and UPI QR                |
| Hold/resume and petty cash                       | Durable held orders and counter-session cash dialog                       |
| Receipt preview, print, share                    | Durable printer jobs plus native share sheet                              |
| Restaurant tables, order modes, modifiers, notes | Restaurant billing components using server metadata                       |
| Pharmacy prescription, batch and expiry          | Prescription context plus FEFO batch selection and expired-stock blocking |
| Wholesale bulk tiers and waybill                 | Server tiers plus invoice-dependent durable waybill queue                 |
| Service technician, parts, duration and warranty | Service configuration dialog with stock-capped parts                      |
| Electronics serial/IMEI and warranty             | Required device capture and duplicate validation                          |
| Scrap/exchange settlement                        | Role-guarded draft scrap purchase queue linked to `SCRAP` payment         |
| Sale history and returns                         | Cached orders with idempotent item-level partial refunds                  |
| Offline persistence                              | Separate SQLite/IndexedDB collections and ordered retry queues            |

The web reference's negative-quantity cart return is intentionally represented by the dedicated native refund flow. This preserves original-sale validation, proportional tax, refund reasons, idempotency, and over-refund prevention instead of creating an unlinked negative sale.
