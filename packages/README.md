# Shared POS packages

- `@indyzai/pos-ui` contains app-neutral React Native UI primitives and formatting utilities.
- `@indyzai/pos-database` contains the shared local database contract, role-scoped collection manifest, IndexedDB implementation, and the SQLite factory boundary.

SQLite schema initialization remains app-owned so each installed app can apply forward-only migrations safely. Both native apps use the same SQLite contract and browser builds use the shared IndexedDB implementation.
