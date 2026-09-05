# OpenPOS

OpenPOS is an open-source, local-first point-of-sale application for managing day-to-day retail operations. It is built with React Native and Expo, with native Android and iOS integrations for a reliable mobile experience.

## Features

- Product, order, and checkout workflows
- Local-first data handling
- Mobile-focused React Native interface
- Android package ID: `com.indyzai.pos.openpos`
- iOS bundle ID: `com.indyzai.pos.openpos`
- Deep-link scheme: `openpos://`

## Project structure

```text
apps/mobile/        React Native / Expo mobile app
packages/core/      Shared OpenPOS business logic and data models
```

## Requirements

- Node.js 20 or later
- Bun
- Android Studio for Android development
- Xcode for iOS development on macOS

## Getting started

Install dependencies from the repository root:

```bash
bun install
```

Start the mobile app:

```bash
bun run mobile:start
```

Run on Android or iOS:

```bash
bun run mobile:android
bun run mobile:ios
```

## Development commands

```bash
# Run mobile tests
bun run --filter mobile test

# Run mobile linting
bun run --filter mobile lint

# Type-check the mobile app
bun run typecheck:mobile
```

## Deployment

The public OpenPOS deployment URLs are placeholders until the production domain is available:

- Application: `https://openpos.example.com`
- Documentation: `https://docs.openpos.example.com`
- API: `https://api.openpos.example.com`

Update these URLs, store listing links, and release metadata before publishing a production build.

## Open source

OpenPOS is maintained as an open-source project. Contributions, bug reports, and feature requests are welcome through this repository.

## License

This project is licensed under the terms in [LICENSE](LICENSE).
