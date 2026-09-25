import { useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Platform,
    Text,
    TextInput,
    View,
} from "react-native";
import { useAuthSession } from "@indyzai/pos-auth/session";
import { usePermissions } from "@indyzai/pos-auth/permissions";
import {
    createLocalFirstTableHook,
    createScopeKey,
    useLocalDatabase,
} from "@indyzai/pos-database";
import type { AppSurface } from "@indyzai/pos-permissions";
import {
    cd410Profile,
    type NativePrinterConfig,
    type PrinterLanguage,
} from "@indyzai/pos-printing";
import { printerTransport } from "@indyzai/pos-printing-native/transport";
import { wakeBillingOutboxWorker } from "@indyzai/pos-sync";
import {
    AppPressable,
    SettingsSelect,
    SettingsToggle,
    useAppTheme,
} from "@indyzai/pos-ui-native";
import {
    createPrinterConfigurationApi,
    nativeConfig,
    validatePrinter,
} from "./configuration";
import {
    printerTarget,
    sendNativePrint,
    type NativePrintActivity,
} from "./nativeDelivery";
import type { CounterPrinter } from "./types";

const usePrinters = createLocalFirstTableHook<CounterPrinter>({
    table: "printers",
    entityType: "PRINTER",
});
const useActivity = createLocalFirstTableHook<NativePrintActivity>({
    table: "print_jobs",
});
const emptyPrinter = (): CounterPrinter => ({
    id: "",
    name: "",
    counterId: "",
    branchId: "",
    type: "thermal",
    printerTypes: ["thermal"],
    connectionType: Platform.OS === "ios" ? "network" : "usb",
    address: "",
    port: "9100",
    paperSize: "80mm",
    status: "UNKNOWN",
    isActive: true,
    isDefault: false,
    copies: 1,
    autoPrint: false,
    config: {
        native: {
            language: "ESC_POS",
            widthMm: 72,
            heightMm: 150,
            gapMm: 2,
            dpi: 203,
            copies: 1,
            autoCut: false,
        },
    },
});

export function PrinterSettings({
    api,
    surface,
    registerSave,
}: {
    api: ReturnType<typeof createPrinterConfigurationApi>;
    surface: AppSurface;
    registerSave?: (save: (() => Promise<void>) | null) => void;
}) {
    const { themeColors: c } = useAppTheme(),
        { session } = useAuthSession(),
        { can } = usePermissions(surface);
    const local = useLocalDatabase(),
        table = usePrinters(),
        activity = useActivity();
    const scope = local.database ? createScopeKey(local.database.scope) : "";
    const [draft, setDraft] = useState<CounterPrinter>(emptyPrinter),
        [localId, setLocalId] = useState<string>();
    const [busy, setBusy] = useState(false),
        locked = useRef(false),
        [message, setMessage] = useState("");
    const [devices, setDevices] = useState<
        Array<{ label: string; value: string; apply: () => void }>
    >([]);
    const [labelTitle, setLabelTitle] = useState(""),
        [labelLines, setLabelLines] = useState(""),
        [barcode, setBarcode] = useState("");
    const editable = can("organization.manage");
    const branches = session?.organization?.branches ?? [];
    const counters =
        branches.find((branch) => branch.id === draft.branchId)?.counters ?? [];
    const config = draft.config?.native as NativePrinterConfig | undefined;
    const patch = (value: Partial<CounterPrinter>) =>
        setDraft((current) => ({ ...current, ...value }));
    const patchConfig = (value: Partial<NativePrinterConfig>) =>
        setDraft((current) => ({
            ...current,
            config: {
                ...current.config,
                native: {
                    ...(current.config?.native as NativePrinterConfig),
                    ...value,
                },
            },
        }));
    useEffect(() => {
        setDraft(emptyPrinter());
        setLocalId(undefined);
        setMessage("");
        setDevices([]);
        setLabelTitle("");
        setLabelLines("");
        setBarcode("");
    }, [scope]);
    const run = async (work: () => Promise<void>) => {
        if (locked.current) return;
        locked.current = true;
        setBusy(true);
        setMessage("");
        try {
            await work();
        } catch (error) {
            setMessage(
                error instanceof Error
                    ? error.message
                    : "Printer action failed.",
            );
        } finally {
            locked.current = false;
            setBusy(false);
        }
    };
    const button = (label: string, onPress: () => void, disabled = false) => (
        <AppPressable
            accessibilityRole="button"
            disabled={busy || disabled}
            onPress={onPress}
            style={{
                borderWidth: 1,
                borderColor: c.outlineMuted,
                borderRadius: 10,
                padding: 12,
                opacity: busy || disabled ? 0.5 : 1,
            }}
        >
            <Text style={{ color: c.text, fontWeight: "600" }}>{label}</Text>
        </AppPressable>
    );
    const field = (
        label: string,
        value: string,
        onChange: (value: string) => void,
        disabled = false,
        multiline = false,
    ) => (
        <View style={{ gap: 5 }}>
            <Text style={{ color: c.textSecondary }}>{label}</Text>
            <TextInput
                accessibilityLabel={label}
                value={value}
                editable={!busy && !disabled}
                multiline={multiline}
                onChangeText={onChange}
                style={{
                    color: c.text,
                    borderColor: c.outlineMuted,
                    borderWidth: 1,
                    borderRadius: 10,
                    padding: 12,
                    minHeight: 48,
                }}
            />
        </View>
    );
    const toggle = (
        label: string,
        value: boolean,
        onChange: (value: boolean) => void,
    ) => (
        <View
            style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
            }}
        >
            <Text style={{ color: c.text, flex: 1 }}>{label}</Text>
            <SettingsToggle
                accessibilityLabel={label}
                value={value}
                disabled={busy || !editable}
                onValueChange={onChange}
            />
        </View>
    );
    const select = (
        label: string,
        value: string,
        options: { label: string; value: string }[],
        onChange: (value: string) => void,
        disabled = !editable,
    ) => (
        <SettingsSelect
            label={label}
            value={value}
            options={options}
            disabled={busy || disabled}
            onChange={onChange}
        />
    );
    const selected = table.data.find((row) => row.id === localId);
    const save = () =>
        run(async () => {
            if (!editable)
                throw new Error(
                    "An administrator must save shared printer settings.",
                );
            validatePrinter(draft);
            if (!counters.some((counter) => counter.id === draft.counterId))
                throw new Error(
                    "Choose a counter belonging to the selected branch.",
                );
            if (selected && !["API", "SYNCED"].includes(selected.syncStatus))
                throw new Error(
                    "Resolve the existing printer change in Settings > Data & sync before editing again.",
                );
            const saved = await table.createMutation({
                payload: {
                    ...draft,
                    copies: nativeConfig(draft).copies,
                    paperSize:
                        draft.type === "thermal"
                            ? draft.paperSize
                            : `${config?.widthMm}x${config?.heightMm}mm`,
                },
                localId,
                operation: selected?.remoteId ? "UPDATE" : "CREATE",
                storeId: draft.branchId,
            });
            wakeBillingOutboxWorker();
            setMessage("Saved locally. Configuration will sync when online.");
            setLocalId(saved.record.id);
            setDraft(saved.record.payload);
            setDevices([]);
        });
    useEffect(() => {
        registerSave?.(editable ? save : null);
        return () => registerSave?.(null);
    }, [registerSave, editable, save]);
    if (!can("printer.manage"))
        return (
            <Text style={{ color: c.textSecondary }}>
                A manager can connect printers. Administrators manage the shared
                counter configuration.
            </Text>
        );
    return (
        <View style={{ gap: 16, paddingBottom: 24 }}>
            <Text style={{ color: c.text, fontSize: 22, fontWeight: "700" }}>
                Printers & counter mapping
            </Text>
            <Text style={{ color: c.textSecondary }}>
                {Platform.OS === "ios"
                    ? "BLE (with a writable characteristic) and raw TCP on iOS native builds. Generic USB and Bluetooth Classic require a supported accessory protocol."
                    : "USB, paired Bluetooth SPP and raw TCP on Android native builds. Expo Go cannot access printers."}{" "}
                Choose the command language configured on the printer.
            </Text>
            {!editable ? (
                <Text style={{ color: c.textSecondary }}>
                    Shared settings are saved by an administrator in the Admin
                    app. You can connect and test a saved printer here.
                </Text>
            ) : null}
            {button(
                "Refresh printers",
                () =>
                    void run(async () => {
                        await api.refresh();
                        setMessage("Printer list refreshed.");
                    }),
            )}
            {table.error ? (
                <Text accessibilityRole="alert" style={{ color: c.text }}>
                    {String(table.error)}
                </Text>
            ) : null}
            {!table.data.length ? (
                <Text style={{ color: c.textSecondary }}>
                    No saved printers. Add one below, or refresh while online.
                </Text>
            ) : null}
            {table.data.map((row) => (
                <View key={row.id} style={{ gap: 5 }}>
                    {button(
                        `${row.payload.name} - ${row.payload.type} - ${row.payload.isActive ? "Enabled" : "Disabled"}`,
                        () => {
                            setLocalId(row.id);
                            setDraft(row.payload);
                            setDevices([]);
                            setMessage("");
                        },
                    )}
                    <Text style={{ color: c.textSecondary }}>
                        {branches
                            .flatMap((branch) =>
                                branch.counters.map((counter) => ({
                                    id: counter.id,
                                    label: `${branch.name} / ${counter.name}`,
                                })),
                            )
                            .find(
                                (counter) =>
                                    counter.id === row.payload.counterId,
                            )?.label ?? row.payload.counterId}{" "}
                        · {row.syncStatus}
                        {row.payload.isDefault ? " · Default" : ""}
                    </Text>
                </View>
            ))}
            {editable
                ? button("Add printer", () => {
                      setLocalId(undefined);
                      setDraft(emptyPrinter());
                      setDevices([]);
                  })
                : null}
            {field(
                "Printer name",
                draft.name,
                (value) => patch({ name: value }),
                !editable,
            )}
            {select(
                "Branch",
                draft.branchId ?? "",
                branches.map((branch) => ({
                    label: branch.name,
                    value: branch.id,
                })),
                (value) => patch({ branchId: value, counterId: "" }),
            )}
            {select(
                "Counter",
                draft.counterId ?? "",
                counters.map((counter) => ({
                    label: counter.name,
                    value: counter.id,
                })),
                (value) => patch({ counterId: value }),
            )}
            {select(
                "Printer purpose",
                draft.type,
                [
                    { label: "Thermal receipt", value: "thermal" },
                    { label: "Barcode label", value: "barcode" },
                    { label: "Shipping label", value: "shipping_label" },
                ],
                (value) => {
                    patch({
                        type: value,
                        printerTypes: [value],
                        autoPrint: false,
                        paperSize:
                            value === "thermal"
                                ? "80mm"
                                : value === "barcode"
                                  ? "50x25mm"
                                  : "100x150mm",
                        config: {
                            ...draft.config,
                            native:
                                value === "thermal"
                                    ? emptyPrinter().config!.native
                                    : {
                                          ...cd410Profile,
                                          model: "Generic",
                                          widthMm:
                                              value === "barcode" ? 50 : 100,
                                          heightMm:
                                              value === "barcode" ? 25 : 150,
                                      },
                        },
                    });
                },
            )}
            {select(
                "Model preset",
                config?.model ?? "Generic",
                [
                    { label: "Generic compatible printer", value: "Generic" },
                    { label: "CD410-UB (203 DPI / TSPL)", value: "CD410-UB" },
                ],
                (value) => {
                    if (value === "CD410-UB")
                        patch({
                            type: "shipping_label",
                            printerTypes: ["shipping_label"],
                            paperSize: "100x150mm",
                            autoPrint: false,
                            config: {
                                ...draft.config,
                                native: { ...config, ...cd410Profile },
                            },
                        });
                    else patchConfig({ model: "Generic" });
                },
            )}
            {select(
                "Connection",
                draft.connectionType ?? "",
                [
                    ...(Platform.OS === "android"
                        ? [{ label: "USB OTG", value: "usb" }]
                        : []),
                    {
                        label:
                            Platform.OS === "ios"
                                ? "Bluetooth LE"
                                : "Bluetooth (paired SPP)",
                        value: "bluetooth",
                    },
                    { label: "Network (TCP)", value: "network" },
                ],
                (value) => {
                    patch({ connectionType: value, address: "" });
                    setDevices([]);
                },
            )}
            {draft.connectionType === "usb" ||
            draft.connectionType === "bluetooth" ? (
                <>
                    {button(
                        draft.connectionType === "usb"
                            ? "Discover attached USB devices"
                            : Platform.OS === "ios"
                              ? "Scan nearby BLE devices"
                              : "Load paired Bluetooth devices",
                        () =>
                            void run(async () => {
                                if (draft.connectionType === "usb") {
                                    const found =
                                        await printerTransport.listUsb();
                                    setDevices(
                                        found.map((device) => ({
                                            label: `${device.name} (${device.vendorId}:${device.productId}, interface ${device.interfaceId})`,
                                            value: `${device.deviceName}:${device.interfaceId}:${device.endpointAddress}`,
                                            apply: () =>
                                                patchConfig({
                                                    usbVendorId:
                                                        device.vendorId,
                                                    usbProductId:
                                                        device.productId,
                                                    usbInterfaceId:
                                                        device.interfaceId,
                                                    usbEndpointAddress:
                                                        device.endpointAddress,
                                                    usbDeviceName:
                                                        device.deviceName,
                                                }),
                                        })),
                                    );
                                    setMessage(
                                        found.length
                                            ? "Select your printer endpoint. Vendor-specific USB devices may not be printers."
                                            : "No compatible USB bulk endpoint found. Check the OTG cable and power.",
                                    );
                                } else {
                                    const found =
                                        await printerTransport.listBluetooth();
                                    setDevices(
                                        found.map((device) => ({
                                            label: `${device.name} (${device.address})`,
                                            value: device.address,
                                            apply: () =>
                                                patch({
                                                    address: device.address,
                                                }),
                                        })),
                                    );
                                    setMessage(
                                        found.length
                                            ? "Select your printer."
                                            : Platform.OS === "ios"
                                              ? "No BLE devices found. Check power and Bluetooth permission."
                                              : "Pair the printer in Android Bluetooth settings first.",
                                    );
                                }
                            }),
                    )}
                    {devices.length
                        ? select(
                              "Select device",
                              "",
                              devices,
                              (value) =>
                                  devices
                                      .find((device) => device.value === value)
                                      ?.apply(),
                              false,
                          )
                        : null}
                    <Text style={{ color: c.textSecondary }}>
                        {draft.connectionType === "usb"
                            ? `USB: ${config?.usbVendorId ?? "not selected"} / ${config?.usbProductId ?? "-"} / interface ${config?.usbInterfaceId ?? "-"}`
                            : `Bluetooth: ${draft.address || "not selected"}`}
                    </Text>
                    {draft.connectionType === "bluetooth" &&
                    Platform.OS === "ios" ? (
                        <>
                            {field(
                                "BLE service UUID",
                                config?.bluetoothServiceUuid ?? "",
                                (value) =>
                                    patchConfig({
                                        bluetoothServiceUuid: value,
                                    }),
                                !editable,
                            )}
                            {field(
                                "BLE writable characteristic UUID",
                                config?.bluetoothCharacteristicUuid ?? "",
                                (value) =>
                                    patchConfig({
                                        bluetoothCharacteristicUuid: value,
                                    }),
                                !editable,
                            )}
                        </>
                    ) : null}
                    {!editable ? (
                        <Text style={{ color: c.textSecondary }}>
                            Selecting a device here is temporary for this
                            session; ask an administrator to save changes.
                        </Text>
                    ) : null}
                </>
            ) : (
                <>
                    {field(
                        "Printer hostname or IP",
                        draft.address ?? "",
                        (value) => patch({ address: value }),
                        !editable,
                    )}
                    {field(
                        "TCP port",
                        draft.port ?? "9100",
                        (value) => patch({ port: value }),
                        !editable,
                    )}
                </>
            )}
            {select(
                "Command language",
                config?.language ?? "",
                (draft.type === "thermal" ? ["ESC_POS"] : ["TSPL", "ZPL"]).map(
                    (value) => ({ label: value, value }),
                ),
                (value) => patchConfig({ language: value as PrinterLanguage }),
            )}
            {draft.type === "thermal"
                ? select(
                      "Receipt paper",
                      draft.paperSize ?? "80mm",
                      [
                          {
                              label: "58 mm roll (48 mm print area)",
                              value: "58mm",
                          },
                          {
                              label: "80 mm roll (72 mm print area)",
                              value: "80mm",
                          },
                      ],
                      (value) => {
                          patch({ paperSize: value });
                          patchConfig({ widthMm: value === "58mm" ? 48 : 72 });
                      },
                  )
                : null}
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
                {(
                    ["widthMm", "heightMm", "gapMm", "dpi", "copies"] as const
                ).map((key) => (
                    <View key={key} style={{ flexGrow: 1, minWidth: 110 }}>
                        {field(
                            {
                                widthMm: "Print width (mm)",
                                heightMm: "Label height (mm)",
                                gapMm: "Label gap (mm)",
                                dpi: "DPI",
                                copies: "Copies",
                            }[key],
                            String(config?.[key] ?? ""),
                            (value) => patchConfig({ [key]: Number(value) }),
                            !editable,
                        )}
                    </View>
                ))}
            </View>
            {toggle("Enabled", draft.isActive, (value) =>
                patch({ isActive: value }),
            )}
            {toggle("Default for this counter", draft.isDefault, (value) =>
                patch({ isDefault: value }),
            )}
            {draft.type === "thermal" ? (
                <>
                    {toggle(
                        "Print automatically after billing",
                        draft.autoPrint,
                        (value) => patch({ autoPrint: value }),
                    )}
                    {toggle(
                        "Cut paper (only if hardware supports it)",
                        config?.autoCut ?? false,
                        (value) => patchConfig({ autoCut: value }),
                    )}
                </>
            ) : null}
            {editable ? button("Save configuration", () => void save()) : null}
            {button(
                "Connect / authorize",
                () =>
                    void run(async () => {
                        await printerTransport.connect(printerTarget(draft));
                        setMessage(
                            draft.connectionType === "network"
                                ? "Network target configured. Use test print to verify the connection."
                                : "Device selected and authorized. Test print verifies the connection and protocol.",
                        );
                    }),
            )}
            {button(
                "Test print",
                () =>
                    void run(async () => {
                        await sendNativePrint(draft, {
                            kind:
                                draft.type === "thermal"
                                    ? "receipt"
                                    : draft.type === "barcode"
                                      ? "barcode"
                                      : "shipping",
                            title: "Printer test",
                            lines: [draft.name],
                            ...(draft.type === "thermal"
                                ? {}
                                : { barcode: "123456" }),
                        });
                        setMessage(
                            "Sent to printer. Check the paper to confirm output.",
                        );
                    }),
            )}
            {draft.type !== "thermal" ? (
                <>
                    <Text
                        style={{
                            color: c.text,
                            fontSize: 18,
                            fontWeight: "700",
                        }}
                    >
                        Print a label
                    </Text>
                    {field("Label title", labelTitle, setLabelTitle)}
                    {field(
                        "Label text / shipping address",
                        labelLines,
                        setLabelLines,
                        false,
                        true,
                    )}
                    {field("Barcode / tracking number", barcode, setBarcode)}
                    {button("Print label", () =>
                        Alert.alert(
                            "Print label",
                            "Check the selected counter, printer and copy count before printing.",
                            [
                                { text: "Cancel", style: "cancel" },
                                {
                                    text: "Print",
                                    onPress: () =>
                                        void run(async () => {
                                            if (!labelTitle.trim())
                                                throw new Error(
                                                    "Enter a label title.",
                                                );
                                            await sendNativePrint(draft, {
                                                kind:
                                                    draft.type === "barcode"
                                                        ? "barcode"
                                                        : "shipping",
                                                title: labelTitle,
                                                lines: labelLines.split("\n"),
                                                barcode,
                                            });
                                            setMessage(
                                                "Label sent. Confirm physical output before printing another copy.",
                                            );
                                        }),
                                },
                            ],
                        ),
                    )}
                </>
            ) : null}
            {busy ? (
                <ActivityIndicator
                    accessibilityLabel="Printer action in progress"
                    color={c.text}
                />
            ) : null}
            {message ? (
                <Text accessibilityRole="alert" style={{ color: c.text }}>
                    {message}
                </Text>
            ) : null}
            <Text style={{ color: c.textSecondary }}>
                Raw text profiles currently support printable ASCII only. These
                shipping labels do not purchase postage or generate
                carrier-certified labels.
            </Text>
            <Text style={{ color: c.text, fontSize: 18, fontWeight: "700" }}>
                Recent device activity
            </Text>
            {activity.data
                .filter((row) => row.payload.printerName)
                .sort((a, b) => b.updatedAt - a.updatedAt)
                .slice(0, 20)
                .map((row) => (
                    <Text key={row.id} style={{ color: c.textSecondary }}>
                        {row.payload.printerName} · {row.payload.title} ·{" "}
                        {row.payload.deliveryState === "SENDING"
                            ? "Sending / if interrupted, check paper"
                            : row.payload.deliveryState}{" "}
                        · {row.payload.copiesSent}/{row.payload.copies} copies
                        sent{row.payload.error ? `\n${row.payload.error}` : ""}
                    </Text>
                ))}
            <Text style={{ color: c.textSecondary }}>
                “Sent” confirms transmission, not physical printing. Interrupted
                jobs are never replayed automatically; check the paper before
                using Print again.
            </Text>
        </View>
    );
}
