export type UsbPrinter = {
    deviceName: string;
    name: string;
    vendorId: number;
    productId: number;
    interfaceId: number;
    endpointAddress: number;
};

export type BluetoothPrinter = { name: string; address: string };
export type SystemPrinter = { name: string; detail?: string };

export type PrinterTarget = {
    connection: "usb" | "bluetooth" | "network" | "system";
    address?: string;
    port?: number;
    serviceUuid?: string;
    characteristicUuid?: string;
} & Partial<UsbPrinter>;

export type TransportCapabilities = {
    usb: boolean;
    bluetooth: boolean;
    network: boolean;
    system: boolean;
    bluetoothKind?: "spp" | "ble";
};
