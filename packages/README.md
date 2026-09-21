# Shared POS packages

- Domain boundaries: `domain`, `application`, `validation`, and `permissions`.
- Data boundaries: `api`, `database`, `database-sqlite`, `sync`, `state`, `storage`, and `storage-native`.
- Presentation boundaries: `ui-core` and `ui-native`.
- Device boundaries: `printing`, `printing-native`, `scanner`, and `scanner-native`.
- Product boundaries live under `features/` and are shared incrementally by both native apps.

SQLite schema initialization remains app-owned so each installed app can apply forward-only migrations safely. There is no web application or web-specific package set in this phase.
