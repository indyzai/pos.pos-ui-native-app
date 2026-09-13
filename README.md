# IndyZAI POS Native App Monorepo

An offline-first, multi-tenant Point of Sale (POS) and POS Admin suite built with **React Native**, **Expo Router**, **Drizzle ORM**, and **Bun**.

---

## Workspace Structure

This monorepo is managed with **Bun Workspaces**, separating front-end consumer applications from reusable domain packages:

```text
pos.pos-ui-native-app/
├── apps/
│   ├── mobile/             # Store POS application (@indyzai/pos-ui-app) — Port 3511
│   └── admin-mobile/       # POS Admin application (@indyzai/pos-ui-admin-app) — Port 3512
└── packages/
    ├── core/               # @indyzai/pos-core: Logging, key-value storage, sync queues, query client, env
    ├── ui/                 # @indyzai/pos-ui: Theme system, Paper provider, navigation, headers, snackbars
    ├── database/           # @indyzai/pos-database: SQLite/Drizzle ORM (native), IndexedDB (web), schemas & sync jobs
    ├── backend/            # @indyzai/pos-backend: GraphQL/REST clients, auth handlers, runtime environment manager
    └── auth/               # @indyzai/pos-auth: Auth session providers, credential storage, role guards & setup screens
```

### Applications

| App | Package Name | Default Port | Description |
| :--- | :--- | :--- | :--- |
| **Store POS** | `@indyzai/pos-ui-app` | `3511` | Cashier & counter billing app (Retail, Restaurant, Pharmacy, Scrap exchange, Bulk tiers). |
| **Admin POS** | `@indyzai/pos-ui-admin-app` | `3512` | Management console for reports, inventory reconciliation, counter sessions, and settings. |

### Shared Packages

- **`@indyzai/pos-core`**: Core infrastructure including the lightweight logger, `SerialQueue` synchronization, `syncEventBus`, `kvStore`, and shared query client.
- **`@indyzai/pos-ui`**: Unified design system tokens, `ThemeProvider`, `AppPaperProvider`, `AppHeaderProvider`, `BottomNavigation`, `SnackbarProvider`, and reusable UI components (`AppPressable`, `AppDropdown`, `AppBottomSheetShell`, `AppKeyboardSafeView`, `PosLogo`).
- **`@indyzai/pos-database`**: Cross-platform database tier utilizing **Drizzle ORM + Expo SQLite** on native platforms and **IndexedDB** on Web. Includes schema definitions, migrations, and sync jobs outbox.
- **`@indyzai/pos-backend`**: Authenticated API client for POS GraphQL and REST endpoints, runtime API environment switching (dev / staging / prod), and 401 unauthorized handling.
- **`@indyzai/pos-auth`**: Authentication session provider, secure credential storage via `expo-secure-store`, role-based access checks (`canAccessStoreApp`, `canAccessAdminApp`), and device onboarding screens.

---

## Getting Started

### Prerequisites

- [Bun](https://bun.sh/) (v1.1+ recommended)
- [Node.js](https://nodejs.org/) (v20+)
- [Expo CLI](https://docs.expo.dev/more/expo-cli/) (`npx expo`)
- iOS Simulator (macOS / Xcode) and/or Android Emulator (Android Studio) for native development.

### Installation

Install all workspace dependencies from the monorepo root:

```bash
bun install
```

---

## Development Scripts

All scripts can be executed directly from the workspace root.

### Running Both Apps Concurrently

You can start both dev servers simultaneously with prefixed logging:

```bash
# Start both Expo dev servers concurrently (Mobile: 3511, Admin: 3512)
bun run both

# Or start both apps directly in Web mode
bun run web:both
```

### Running Individual Apps

#### Store POS App (`apps/mobile` — Port 3511)

```bash
# Interactive Expo CLI
bun run start

# Web browser
bun run web

# Android emulator / connected device
bun run android

# iOS simulator
bun run ios
```

#### POS Admin App (`apps/admin-mobile` — Port 3512)

```bash
# Interactive Expo CLI
bun run admin:start

# Web browser
bun run admin:web

# Android emulator / connected device
bun run admin:android

# iOS simulator
bun run admin:ios
```

---

## Testing & Code Quality

### Automated Unit Tests

Runs all test suites across applications and packages:

```bash
bun test
```

### TypeScript Validation

Typecheck all applications with zero emit:

```bash
bun run typecheck
```

### Prettier Formatting

Check or apply consistent code formatting:

```bash
# Verify formatting
bun run format:check

# Format all files in workspaces
bun run format
```

---

## Offline-First Architecture & Design Principles

1. **Dual Storage Engine**:
   - **Native (iOS & Android)**: SQLite managed through **Drizzle ORM** with local schema migrations.
   - **Web**: IndexedDB adapter that satisfies the same repository interfaces without requiring WebAssembly or `SharedArrayBuffer`.
2. **Tenant & User Isolation**:
   - All stored records and outboxes are strictly scoped by `tenantId` and authenticated user to prevent data cross-contamination.
3. **Outbox & Dependency Syncing**:
   - Inbound and outbound mutations are queued locally before network dispatch.
   - Outbox processing runs through serialized FIFO queues (`SerialQueue`) to guarantee transaction ordering (e.g. scrap purchase credits must sync before linked bills).
4. **Credential Security**:
   - Sensitive tokens and device registration PINs are persisted in `expo-secure-store` (never in unencrypted SQLite tables).

---

## Environment Configuration

Configure custom API endpoints by setting environment variables in `.env` or Expo configuration:

| Variable | Default | Purpose |
| :--- | :--- | :--- |
| `EXPO_PUBLIC_POS_API_URL` | `https://api.indyzai.com/pos/api/graphql` | Main POS GraphQL backend endpoint |
| `EXPO_PUBLIC_AUTH_API_URL` | `https://api.indyzai.com/auth` | Authentication endpoint |
| `EXPO_PUBLIC_ENVIRONMENT` | `production` | Default environment (`development`, `staging`, `production`) |
