# Native printer setup

Both apps expose **Settings → Printer configuration**. Shared configuration changes require administrator access in Admin, matching the deployed printer API. POS managers can select, connect and test saved devices. Cashier billing uses its counter's active receipt printer without exposing management controls.

## Supported implementation

- Android USB host/OTG: discovers printer-class and vendor-specific interfaces with bulk OUT endpoints, requests per-device access, claims the selected interface and transmits bounded chunks. This is not a USB-serial/CDC or proprietary vendor driver.
- Android Bluetooth Classic SPP: pair in Android Settings, then load paired devices. Android 12+ requests Nearby devices permission.
- iOS Bluetooth LE: scan a nearby peripheral, then enter the printer's writable-with-response GATT service and characteristic UUIDs. The printer must actually accept the configured command language over that characteristic. Bluetooth Classic SPP and generic USB host printing are unavailable through this transport on iOS; vendor/MFi accessory integration would require a printer-specific implementation.
- iOS raw TCP: specify the printer hostname/IP and port. Local network and Bluetooth permission prompts are configured in both apps. Expo Go cannot load the native printer module.
- Linux and Windows Node/Electron: import `@indyzai/pos-printing-native/transport` and use raw TCP or `connection: 'system'` with an installed OS print queue. `listSystemPrinters()` returns available queue names. Linux uses CUPS `lp -o raw`; Windows uses the Win32 raw spooler. USB and Bluetooth printers work through their installed OS drivers/queues, not through direct JS device enumeration. The printer/driver must accept raw ESC/POS, TSPL or ZPL bytes.
- Android raw TCP: specify printer hostname/IP and port (usually 9100); no network scanning or discovery. Raw printer sockets are unencrypted: use a trusted local network.
- ESC/POS receipt commands, optional cutter, 58/80 mm roll presets, configured print width and copies.
- TSPL and ZPL barcode/shipping-label commands with structured text, Code 128, dimensions and overflow validation. Command characters are escaped/rejected. Printable ASCII only; images, logos, Unicode rasterization and vendor font/code-page drivers are not implemented.
- CD410-UB preset: TSPL, 203 DPI, 100 × 150 mm label, 2 mm gap, no cutter. Adjust to actual media. Manufacturer CD410 family documentation lists USB/SPP and TSPL compatibility; exact CD410-UB firmware, USB endpoint and command mode require an actual test print. A matching product name alone is not hardware verification.
- Shipping output is a generic address/tracking label, not postage purchase or a carrier-certified shipping label.

## Installation and first print

1. Install a new **native Android or iOS build** of the desired app. The workspace module is detected by Expo autolinking in both apps. Expo Go and an OTA JavaScript update alone cannot add this native driver.
2. In Admin, select the branch/counter, purpose and model/protocol. For USB connect a powered printer through a USB-host/OTG cable and select the actual endpoint. For Bluetooth pair first. For TCP supply the address/port.
3. Save configuration. It is first persisted in the scoped `printers` table and `sync_outbox`, then pushed using `createCounterPrinter` / `updateCounterPrinter`. Background loads write the table before UI consumers read it. Default, enabled, copies and auto-print settings are saved to the API.
4. Open the counter on POS. Configuration refresh runs quietly in the background when online. Use Refresh printers to fetch immediately. Once cached, USB/Bluetooth printing works without internet where supported; TCP still needs local network access.
5. Select the saved device, authorize, and test print. Verify media size, margins, barcode scanning, cut setting and every copy on physical paper before enabling automatic receipt printing.

## Reliability and offline behavior

- Billing reads cached configuration without waiting for API discovery; auto-print does not block sale persistence. Native output is never also submitted to the server's remote print dispatcher.
- Device activity is saved to `print_jobs` before transmission. `SENT` means bytes transmitted, not physical output. Failed or interrupted writes are `UNCERTAIN`; `SENDING` left after a restart also requires checking paper. Physical jobs are never automatically replayed. Reprint only after inspecting the output; successful earlier copies may already exist.
- Configuration changes are durable offline mutations. Failed changes appear in Settings → Data & sync. Printer creation currently lacks server-side idempotency: a durable client marker recovers lost acknowledgements. If a prior creation may have been sent but cannot be found, retries stop instead of risking a duplicate. Verify the server before discarding/recreating that configuration. Update retries use the recovered server ID.
- USB device paths can change after reconnect; the transport re-enumerates VID/PID/interface/endpoint and accepts only one unambiguous match. Identical connected printers require explicit selection again. Temporary device selection in POS does not overwrite shared settings.
- Printer disable/default changes apply locally and sync to the server. Previously queued server-agent jobs retain their existing remote workflow; native device activity is local-only and not a server print confirmation.

## Verification and remaining release checks

Focused unit tests cover commands/escaping, receipt context, native-vs-server routing, cache-only billing selection, configuration persistence, lost-response recovery and account-switch guards. Expo autolinking resolves the Android module for both applications.

No build or type check was run, per request. No physical printer was connected. Native compilation, iOS permission/scan/write, Windows/Linux spooler integration, USB permission/deny/reconnect, Bluetooth pair/reconnect, network interruption, multi-copy partial failure, offline restart, barcode scan quality and CD410-UB firmware compatibility still require device validation. Raster/Unicode, carrier integrations and server-side idempotent printer creation are not claimed complete.

References: [CD410 manufacturer specifications](https://www.a-printer.com/uploads/40213/files/CD410.pdf?rnd=516), [Android USB host](https://developer.android.com/develop/connectivity/usb/host), [Android Bluetooth permissions](https://developer.android.com/develop/connectivity/bluetooth/bt-permissions).
