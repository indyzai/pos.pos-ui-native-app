# Shared POS packages

- Domain boundaries: `domain`, `application`, `validation`, and `permissions`.
- Data boundaries: `api`, `database`, `database-sqlite`, `sync`, `state`, `storage`, and `storage-native`.
- Presentation boundaries: `ui-core` and `ui-native`.
- Device boundaries: `printing`, `printing-native`, `scanner`, and `scanner-native`.
- Product packages use `feature-*` directories. Billing calculations, refund rules, inventory reconciliation, purchase splits, printer selection, authentication, and feature flags now have shared implementations.

App-local compatibility modules re-export shared domain functions so existing imports and tests keep working during extraction. App-specific repositories and screens still require further migration; a package directory alone does not indicate a completed feature.

SQLite schema initialization remains app-owned so each installed app can apply forward-only migrations safely. There is no web application or web-specific package set in this phase.
