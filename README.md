# IndyZAI POS Native Monorepo

Offline-first iOS and Android POS applications built with React Native, Expo Router, SQLite, Drizzle ORM, and Bun workspaces.

## Workspace

`apps/pos-mobile` and `apps/admin-mobile` consume `@indyzai` workspaces from the `vendor/pos-ui-shared` Git submodule. Its `packages/` folder contains code shared with web React, and `packages-native/` contains Expo and native-only packages. Initialize the submodule before installing dependencies:

```bash
git submodule update --init --recursive
bun install
```

## Applications

| App       | Package                 | Port | Purpose                                                                                         |
| --------- | ----------------------- | ---: | ----------------------------------------------------------------------------------------------- |
| Store POS | `@indyzai/pos-mobile`   | 3511 | Billing, customers, orders, inventory, purchases, and reconciliation for cashier/manager roles. |
| POS Admin | `@indyzai/admin-mobile` | 3512 | Management workflows for admin, owner, and super-admin roles.                                   |

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

Implementation status and remaining work: [platform implementation](docs/platform-implementation.md).

## Environment

| Variable                   | Default                                   | Purpose                 |
| -------------------------- | ----------------------------------------- | ----------------------- |
| `EXPO_PUBLIC_POS_API_URL`  | `https://api.indyzai.com/pos/api/graphql` | POS GraphQL endpoint    |
| `EXPO_PUBLIC_AUTH_API_URL` | `https://api.indyzai.com/auth/api/v1`     | Authentication endpoint |
| `EXPO_PUBLIC_POS_BASE_URL` | `https://api.indyzai.com/pos/api`         | POS REST base URL       |

For a native iOS build:

```bash
npx expo prebuild --platform ios
open ios/*.xcworkspace

Select the IndyzAIPOS target → Build Settings.
Add a user-defined setting:RCT_METRO_PORT = 3511
```
