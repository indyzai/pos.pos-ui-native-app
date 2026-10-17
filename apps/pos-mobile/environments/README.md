POS mobile API profiles

From the workspace root, run `bun run pos:local` or `bun run pos:production`. These copy the selected public API settings into `apps/pos-mobile/.env` and restart Expo with a cleared cache. To select without starting Expo, run `bun run env:local` or `bun run env:production` inside `apps/pos-mobile`.

Local APIs use POS port 3501 and auth port 3504. `localhost` works for the iOS simulator and browser. For Android emulator use `adb reverse tcp:3501 tcp:3501` and `adb reverse tcp:3504 tcp:3504`, or replace localhost with `10.0.2.2`. For a physical phone, replace localhost in `environments/.env.local` with the computer's LAN IP, ensure both APIs listen on that interface, then rerun `env:local` and restart Expo. Auth sessions belong to their API environment; sign in to the selected server when switching.

The selected file controls the API environment on every platform; previously saved device preferences cannot override it. Other keys in the working `.env` are preserved by the profile script. Avoid additional Expo `.env.local` overrides as they take precedence over `.env`. These profiles contain only public URLs; keep secrets out of EXPO_PUBLIC variables.

Reports → Business dashboard shows the configured multi-widget layout. Default layouts are read-only; **Copy and edit** creates your organization's editable copy.
