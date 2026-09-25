# Mobile component boundaries

Both `apps/pos-mobile` and `apps/admin-mobile` compose shared package components.

- `@indyzai/pos-ui-native` owns the phone bottom navigation and tablet navigation pane. Apps supply visible items, active-route matching, and navigation callbacks; role and feature-flag filtering remain in app adapters.
- `@indyzai/feature-billing/native/<Component>` owns the billing catalog, cart, checkout, customization dialogs, session stats, and petty-cash dialog. Its `domain/scrapExchange` export provides the shared exchange builder.
- `@indyzai/feature-orders/native/RefundDialog` owns the refund form used by both apps.
- `@indyzai/feature-inventory/reconcile-modal` owns the stock-count form. POS supplies `onSaveDraft`; admin supplies the `Save count` action label.

Routes, authenticated API adapters, providers, and screens that coordinate app services remain in the apps. Shared components accept data and callbacks rather than importing application files. Add reusable UI to the owning package and declare its dependencies and public exports there.
