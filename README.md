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
bun run test:pos
bun run test:admin
bun run test
```

Run tests through these package scripts: they isolate each test file so native-module and database mocks cannot leak into other suites. App scripts also load the shared test setup explicitly, including when CI runs from an app directory.

The native apps read UI state from the local database. Server mutations are written to the local outbox and synchronized when connectivity is available.

Implementation status and remaining work: [platform implementation](docs/platform-implementation.md).

## Environment

| Variable                   | Default                                   | Purpose                 |
| -------------------------- | ----------------------------------------- | ----------------------- |
| `EXPO_PUBLIC_POS_API_URL`  | `https://api.indyzai.com/pos/api/graphql` | POS GraphQL endpoint    |
| `EXPO_PUBLIC_AUTH_API_URL` | `https://api.indyzai.com/auth/api/v1`     | Authentication endpoint |
| `EXPO_PUBLIC_POS_BASE_URL` | `https://api.indyzai.com/pos/api`         | POS REST base URL       |

For a native iOS build, run from the mobile app directory:

```bash
cd apps/pos-mobile
bun x expo prebuild --platform ios --no-clean
open ios/IndyzAIPOS.xcworkspace
```

Select the IndyzAIPOS target in Xcode. Use `RCT_METRO_PORT = 3511` for POS
or `3512` for the admin app when configuring a custom Metro port.

Both apps use Expo SDK 58 with React Native 0.88 and React 19.3. SDK 58 generates
`SceneDelegate.swift` and the scene manifest required by Xcode 27/iOS 27; the
SDK 57 `enableSceneSupport` opt-in is no longer needed. After updating native
dependencies or lifecycle configuration, rebuild and reinstall the app.
Restarting Metro alone cannot update an installed native executable.

Use Node 24 (`nvm use` reads the root `.nvmrc`) before running Expo commands.
Bun uses the hoisted linker configured in `bunfig.toml` so the apps and shared
packages resolve one installation of each native module. Run `bun install` from
this repository's root, rather than installing dependencies inside the vendored
shared workspace. The combined `bun run ios-build` command regenerates projects
sequentially to avoid CocoaPods cache collisions. `--no-clean` preserves existing
native project settings for routine prebuilds; major SDK upgrades require fresh
native templates and restoring any local signing settings.
