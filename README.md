# IndyZAI POS Native Monorepo

Offline-first iOS and Android POS applications built with React Native, Expo Router, SQLite, Drizzle ORM, and Bun workspaces.

## Workspace

```text
apps/
├── pos-mobile/                 # Cashier and manager POS app
└── admin-mobile/               # Admin, owner, and super-admin app

packages/
├── domain/                     # Shared domain primitives
├── application/                # Use-case contracts
├── validation/                 # Validation contracts
├── permissions/                # Roles and entitlement map
├── api/                        # GraphQL/REST clients
├── sync/                       # Sync queue primitives and events
├── state/                      # Shared query state
├── database/                   # Local-first schema, repositories, and outbox
├── database-sqlite/            # Native SQLite adapter entry point
├── ui-core/                    # Platform-neutral UI models
├── ui-native/                  # Shared React Native components and theme
├── printing/                   # Printing contracts
├── printing-native/            # Native printing entry point
├── scanner/                    # Scanner contracts
├── scanner-native/             # Native scanner entry point
├── storage/                    # Storage contracts
├── storage-native/             # Secure native key-value storage
├── config/                     # Environment and endpoint configuration
├── utils/                      # Logging and general utilities
└── features/
    ├── inventory/
    ├── purchase/
    ├── users/
    ├── finance/
    ├── reports/
    ├── organization/
    └── dashboard/
```

There is intentionally no web application or web-specific UI, printing, scanner, or storage package in this phase.

## Applications

| App | Package | Port | Purpose |
| --- | --- | ---: | --- |
| Store POS | `@indyzai/pos-mobile` | 3511 | Billing, customers, orders, inventory, purchases, and reconciliation for cashier/manager roles. |
| POS Admin | `@indyzai/admin-mobile` | 3512 | Management workflows for admin, owner, and super-admin roles. |

## Commands

```bash
bun install
bun run start
bun run admin:start
bun run both
bun run android
bun run ios
bun run typecheck
bun test
```

The native apps read UI state from the local database. Server mutations are written to the local outbox and synchronized when connectivity is available.

## Environment

| Variable | Default | Purpose |
| --- | --- | --- |
| `EXPO_PUBLIC_POS_API_URL` | `https://api.indyzai.com/pos/api/graphql` | POS GraphQL endpoint |
| `EXPO_PUBLIC_AUTH_API_URL` | `https://api.indyzai.com/auth/api/v1` | Authentication endpoint |
| `EXPO_PUBLIC_POS_BASE_URL` | `https://api.indyzai.com/pos/api` | POS REST base URL |

For a native iOS build:

```bash
npx expo prebuild --platform ios
open ios/*.xcworkspace
```
