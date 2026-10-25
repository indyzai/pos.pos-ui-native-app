# Native POS parity implementation

Implemented for POS and Admin mobile using shared feature components. Finance workspaces (expenses, ledger, reconciliation and payment tracking) and HR attendance, leave and payroll remain excluded.

| Area                  | Delivered behavior                                                                                                                                                       |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Stock transfers       | Branch/product selection, quantity validation, offline creation, approval/rejection, transit and completion status workflow.                                             |
| Contacts              | Customer and supplier outstanding balances, collect/pay dialog, payment audit, recent invoice history and customer credit-limit editing.                                 |
| Services              | Technician contacts are available at billing; service products can specify a default technician, duration and warranty.                                                  |
| Logistics             | Waybill item and transport details, status workflow, shipping bills generated from waybills, native label printing and PDF sharing.                                      |
| Payment configuration | Payment methods, linked bank accounts and per-business payment settings.                                                                                                 |
| Shifts                | Searchable shift history with opening, closing, expected cash and differences.                                                                                           |
| Scrap                 | Stock/rate management, purchases, sales, categories and vendor navigation; stock reserved atomically for queued sales.                                                   |
| Organization          | Branches, counters, restaurant tables and staff assignments with role restrictions.                                                                                      |
| Inventory labels      | Barcode-label action using configured compatible TSPL/ZPL native printers.                                                                                               |
| Language              | Durable organization/device/user language settings drive English, Hindi and Tamil interface labels. Unknown phrases fall back to English; business content is preserved. |

## Persistence and replay

New collections use separate scoped SQLite tables and IndexedDB stores. Queued writes have stable IDs and registered replay transports. Local writes are transactional; failed queue writes retain form input and do not reserve stock. Refresh preserves pending records and rejects stale-session or malformed responses. Backend create operations use mutation receipts for safe retries where added by this implementation.

Stock transfer workflow follows the existing web/API logistics model. Product stock remains organization-wide; this change does not introduce a branch stock ledger. Waybill documents are internal logistics records and do not represent government e-waybill submission.

## Deployment

Deploy the API changes together with the apps. Apply the new `1800000017000-payment-org-settings` migration for the configured PostgreSQL or Oracle driver before starting the updated API. This adds per-organization payment settings so an edit cannot affect another business using the same payment definition. No migration has been run against a live database by this change.

Native local database migration 0009 / runtime schema version 13 runs on initialization. It separates cached logistics records from pending waybill jobs and preserves existing jobs. Migration 0010 provisions supplier storage for both POS and Admin profiles without replacing existing records. IndexedDB uses schema version 170.

Printer/PDF actions reuse installed Expo Print and Sharing modules, loaded on demand. Barcode labels require a compatible configured printer. Physical printing and device interaction still require device acceptance testing.

## Verification

- Both mobile TypeScript projects pass.
- 390 app/shared tests pass, including transaction rollback, offline replay, stock reservation, account settlements, migration preservation and printer selection.
- Backend TypeScript passes; 21 focused backend tests pass across logistics, payment isolation, staff, scrap and idempotency.
- All operations GraphQL documents validate against the API schema.
- POS iOS production bundle exports successfully.
- Frozen lockfile validation passes; whitespace checks pass.
- Browser testing was skipped as requested. No live deployment or hardware test was performed.

The shared implementation is present in the app's vendored shared checkout and mirrored into the sibling shared repository while preserving its existing edits.

## Printer workspace and app responsibilities

The printer workspace follows the web reference with Print Queue, Printers, Counter Mapping (Admin only) and Health tabs. It shows recent server history alongside local device activity, branch filters, status filters, copy progress, errors and job details. Health uses reported status and observed job counts; it does not invent device telemetry. Shared configuration opens in Admin; POS managers can connect and test saved printers. Interrupted native jobs are retained and never automatically replayed.

POS navigation covers billing, stock operations, purchases, logistics, scrap and shifts. Admin retains all operational oversight modules as well as branches, counters, staff assignments, catalog setup, payment/bank setup and shared printer configuration. Reports, inventory, contacts and printer visibility remain available as appropriate to each app and role. Direct-route guards and settings links follow the same split.

Printer hardware testing was not performed. The server history endpoint returns the latest 200 jobs; older cached activity remains visible.

## Thermal receipt PDFs and document previews

Order details now open a thermal preview before sharing a PDF. Users can select 58 mm or 80 mm paper. Preview, PDF and physical receipt printing share one document model, including saved line totals, discounts, payment splits, credit-note references and notes. Long PDFs paginate at the same narrow width without clipping the final items.

New local print jobs retain their document snapshot and paper layout. The queue preserves that snapshot when a server status update arrives. Older receipt jobs load a reconstructed preview from the cached order or the API; the UI labels this clearly. Older non-receipt jobs without a saved document show that a preview is unavailable rather than inventing content.

Receipt alignment now centers business/branch headings, uses fixed numeric item columns and right-aligned totals, formats dates in the business timezone where available, and avoids duplicate single-method payment rows. The same formatter drives the preview, thermal PDF and new native receipt prints. Print-job details open directly on Preview, with metadata in a separate tab; update-tree `documentReference` fields are recognized for older receipt lookup.

## Inventory barcode batches

Barcode printing is now a toolbar action. Users can add multiple existing products, set per-item whole label quantities and preview Code 128 bars on white paper before confirming print. Printer dimensions drive the preview. Native delivery splits large quantities into audited chunks of up to 20 copies, supports stopping between chunks, and never automatically retries an uncertain batch.

After a reconciliation is saved locally, positive stock additions offer label previews with quantities prefilled from the increase. Reductions do not offer labels. Products without supported barcodes are listed for correction; fractional stock increases require choosing a whole label quantity. Barcode generation/preview tests, batch workflow tests and both app typechecks passed. Further iOS checks were skipped at the user's request.
