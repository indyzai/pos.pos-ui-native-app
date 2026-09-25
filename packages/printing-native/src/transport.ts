import { PermissionsAndroid, Platform } from "react-native";
import { requireOptionalNativeModule } from "expo-modules-core";
import type {
    BluetoothPrinter,
    PrinterTarget,
    TransportCapabilities,
    UsbPrinter,
} from "./types";
export type {
    BluetoothPrinter,
    PrinterTarget,
    TransportCapabilities,
    UsbPrinter,
} from "./types";

interface NativePrinter {
    listUsb(): Promise<UsbPrinter[]>;
    requestUsbPermission(name: string): Promise<boolean>;
    listBluetooth(): Promise<BluetoothPrinter[]>;
    write(
        config: PrinterTarget,
        base64: string,
    ): Promise<{ bytesWritten: number }>;
}
function native(): NativePrinter {
    if (Platform.OS !== "android" && Platform.OS !== "ios")
        throw new Error(
            "Use the desktop transport for Linux or Windows printer queues.",
        );
    const module = requireOptionalNativeModule<NativePrinter>("IndyzPrinter");
    if (!module)
        throw new Error(
            `Install a native ${Platform.OS === "ios" ? "iOS" : "Android"} build with the printer module. Expo Go cannot access printers.`,
        );
    return module;
}
async function bluetoothPermission() {
    if (Platform.OS === "android" && Number(Platform.Version) >= 31) {
        const result = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        );
        if (result !== PermissionsAndroid.RESULTS.GRANTED)
            throw new Error(
                "Allow Nearby devices permission to use paired printers.",
            );
    }
}
export const printerTransport = {
    capabilities(): TransportCapabilities {
        return Platform.OS === "android"
            ? {
                  usb: true,
                  bluetooth: true,
                  network: true,
                  system: false,
                  bluetoothKind: "spp",
              }
            : {
                  usb: false,
                  bluetooth: true,
                  network: true,
                  system: false,
                  bluetoothKind: "ble",
              };
    },
    listUsb: () => {
        if (Platform.OS !== "android")
            throw new Error(
                "Generic USB host printing is available on Android. iOS requires a supported MFi accessory protocol.",
            );
        return native().listUsb();
    },
    async listBluetooth() {
        const module = native();
        await bluetoothPermission();
        return module.listBluetooth();
    },
    async connect(target: PrinterTarget): Promise<PrinterTarget> {
        const module = native();
        if (target.connection === "system")
            throw new Error(
                "Installed printer queues are a desktop transport.",
            );
        if (target.connection === "usb") {
            if (Platform.OS !== "android")
                throw new Error(
                    "Generic USB host printing is unavailable on iOS. Use a BLE or network printer.",
                );
            const matches = (await module.listUsb()).filter(
                (device) =>
                    device.vendorId === target.vendorId &&
                    device.productId === target.productId &&
                    device.interfaceId === target.interfaceId &&
                    device.endpointAddress === target.endpointAddress,
            );
            const selected =
                matches.find(
                    (device) => device.deviceName === target.deviceName,
                ) ?? (matches.length === 1 ? matches[0] : undefined);
            if (!selected)
                throw new Error(
                    "USB printer missing or ambiguous. Discover and select it again.",
                );
            if (!(await module.requestUsbPermission(selected.deviceName)))
                throw new Error("USB printer access denied or timed out.");
            return { ...target, ...selected };
        }
        if (target.connection === "bluetooth") {
            if (Platform.OS === "ios") {
                if (
                    !target.address ||
                    !/^[\da-f]{8}(-[\da-f]{4}){3}-[\da-f]{12}$/i.test(
                        target.address,
                    )
                )
                    throw new Error(
                        "Select a nearby BLE printer. iOS uses a peripheral UUID, not a MAC address.",
                    );
                if (
                    !target.serviceUuid?.trim() ||
                    !target.characteristicUuid?.trim()
                )
                    throw new Error(
                        "Enter the printer BLE service and writable characteristic UUIDs.",
                    );
                return target;
            }
            await bluetoothPermission();
            const paired = await module.listBluetooth();
            if (
                !paired.some(
                    (device) =>
                        device.address.toLowerCase() ===
                        target.address?.toLowerCase(),
                )
            )
                throw new Error(
                    "Pair the printer in Android Bluetooth settings first.",
                );
        }
        if (target.connection === "network") {
            if (
                !target.address?.trim() ||
                !Number.isInteger(target.port) ||
                target.port! < 1 ||
                target.port! > 65535
            )
                throw new Error("Enter a printer hostname and TCP port.");
        }
        return target;
    },
    async write(target: PrinterTarget, base64: string) {
        const connected = await this.connect(target);
        return native().write(connected, base64);
    },
};
