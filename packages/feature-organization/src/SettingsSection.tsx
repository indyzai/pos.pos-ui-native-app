import { useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import {
    createLocalFirstTableHook,
    createScopeKey,
    useLocalDatabase,
} from "@indyzai/pos-database";
import { useAuthSession } from "@indyzai/pos-auth/session";
import { usePermissions } from "@indyzai/pos-auth/permissions";
import type { AppSurface } from "@indyzai/pos-permissions";
import { featureToggleLabels } from "@indyzai/feature-flags";
import { useFeatureToggles } from "@indyzai/feature-flags/react";
import {
    AppPressable,
    SettingsSelect,
    SettingsToggle,
    useAppTheme,
    showSnackbar,
} from "@indyzai/pos-ui-native";
import {
    settingsFields,
    validateSettingsPatch,
    type SettingsRecord,
    type SettingsSection as Section,
    type SettingsValues,
} from "./settingsSchema";

const useSettings = createLocalFirstTableHook<SettingsRecord>({
    table: "app_settings",
    entityType: "SETTINGS",
});

/** Apply only durable settings to consumers, including restored offline sessions. */
export function SettingsBridge() {
    const table = useSettings();
    const auth = useAuthSession();
    const { setMode, setPrimaryColor } = useAppTheme();
    const local = useLocalDatabase();
    const id = local.database
        ? `${createScopeKey(local.database.scope)}:app_settings:business`
        : "";
    const businessValues = table.data.find((row) => row.id === id)?.payload
        .values;
    const deviceValues = table.data.find((row) => row.id === `${id}:device`)
        ?.payload.values;
    const values = useMemo(
        () =>
            businessValues || deviceValues
                ? { ...businessValues, ...deviceValues }
                : undefined,
        [businessValues, deviceValues],
    );
    useEffect(() => {
        if (values?.theme === "light" || values?.theme === "dark")
            setMode(values.theme);
        setPrimaryColor(
            typeof values?.primaryColor === "string"
                ? values.primaryColor
                : null,
        );
    }, [values?.theme, values?.primaryColor]);
    useEffect(
        () => () => {
            setMode(null);
            setPrimaryColor(null);
        },
        [],
    );
    useEffect(() => {
        if (!values || !auth.session?.organization) return;
        const current = auth.session.organization.settings;
        const features = Object.fromEntries(
            Object.entries(values).filter(
                ([key, value]) =>
                    key in featureToggleLabels && typeof value === "boolean",
            ),
        ) as Record<string, boolean>;
        if (
            Object.entries(values).some(
                ([key, value]) => current[key] !== value,
            ) ||
            Object.entries(features).some(
                ([key, value]) =>
                    (current.features as Record<string, unknown> | undefined)?.[
                        key
                    ] !== value,
            )
        )
            void auth
                .applyOrganizationSettings(values, features)
                .catch(() => undefined);
    }, [values, auth.session]);
    return null;
}

export function SettingsSection({
    section,
    surface,
    registerSave,
}: {
    section: Section;
    surface: AppSurface;
    registerSave?: (save: (() => Promise<void>) | null) => void;
}) {
    const { themeColors: c } = useAppTheme();
    const auth = useAuthSession();
    const local = useLocalDatabase();
    const table = useSettings();
    const { can } = usePermissions(surface);
    const { flags } = useFeatureToggles();
    const localOnly =
        surface === "pos" && ["appearance", "devices"].includes(section);
    const editable = can("organization.manage") || localOnly;
    const [draft, setDraft] = useState<SettingsValues>({});
    const [busy, setBusy] = useState(false);
    const saving = useRef(false);
    const [error, setError] = useState("");
    const id = local.database
        ? `${createScopeKey(local.database.scope)}:app_settings:business`
        : "";
    const businessRecord = table.data.find((row) => row.id === id);
    const deviceRecord = table.data.find((row) => row.id === `${id}:device`);
    const record = localOnly ? deviceRecord : businessRecord;
    const base = useMemo(
        () =>
            Object.fromEntries(
                Object.entries({
                    businessName:
                        auth.session?.organization?.name ??
                        auth.session?.tenant.name ??
                        "",
                    currency: "INR",
                    timezone: "Asia/Kolkata",
                    theme: "light",
                    language: "en",
                    taxCalculation: "inclusive",
                    roundOffTotal: true,
                    ...auth.session?.organization?.settings,
                    ...flags,
                    ...businessRecord?.payload.values,
                    ...deviceRecord?.payload.values,
                }).filter(
                    ([key, value]) =>
                        settingsFields.some((field) => field.key === key) &&
                        ["string", "boolean", "number"].includes(typeof value),
                ),
            ) as SettingsValues,
        [auth.session, flags, businessRecord, deviceRecord],
    );
    const values = { ...base, ...draft };
    useEffect(() => {
        setDraft({});
        setError("");
    }, [id]);
    const save = async () => {
        if (
            !editable ||
            saving.current ||
            !local.database ||
            !Object.keys(draft).length
        )
            return;
        saving.current = true;
        setBusy(true);
        setError("");
        try {
            const patch = validateSettingsPatch(draft);
            if (localOnly) {
                const allowed = new Set(
                    settingsFields
                        .filter((field) =>
                            ["appearance", "devices"].includes(field.section),
                        )
                        .map((field) => field.key),
                );
                if (Object.keys(patch).some((key) => !allowed.has(key)))
                    throw new Error("Save business settings in the Admin app.");
                await local.database.collection("app_settings").put({
                    id: `${id}:device`,
                    scope: createScopeKey(local.database.scope),
                    tenantId: local.database.scope.tenantId,
                    remoteId: `${id}:device`,
                    serverVersion: 0,
                    syncStatus: "API",
                    updatedAt: Date.now(),
                    payload: {
                        id: `${id}:device`,
                        values: {
                            ...deviceRecord?.payload.values,
                            ...patch,
                        },
                    },
                });
            } else {
                const stored = Object.fromEntries(
                    Object.entries(
                        auth.session?.organization?.settings ?? {},
                    ).filter(
                        ([key, value]) =>
                            settingsFields.some((field) => field.key === key) &&
                            ["string", "boolean", "number"].includes(
                                typeof value,
                            ),
                    ),
                ) as SettingsValues;
                await table.createMutation({
                    operation: "UPDATE",
                    localId: id,
                    payload: {
                        id,
                        values: {
                            ...stored,
                            ...businessRecord?.payload.values,
                            ...patch,
                        },
                        patch,
                    },
                });
            }
            setDraft({});
            showSnackbar(
                "Settings saved on this device",
                localOnly
                    ? "Device preferences are available offline."
                    : "Changes are queued and will sync when online.",
            );
        } catch (reason) {
            setError(
                reason instanceof Error
                    ? reason.message
                    : "Unable to save settings.",
            );
        } finally {
            saving.current = false;
            setBusy(false);
        }
    };
    const saveRef = useRef(save);
    saveRef.current = save;
    useEffect(() => {
        registerSave?.(editable ? () => saveRef.current() : null);
        return () => registerSave?.(null);
    }, [editable, registerSave]);
    const change = (key: string, value: string | boolean) =>
        setDraft((current) => ({ ...current, [key]: value }));
    const fields = settingsFields.filter((field) => field.section === section);
    return (
        <View style={s.root}>
            <Text style={[s.heading, { color: c.text }]}>
                {
                    {
                        general: "Business information",
                        appearance: "Appearance",
                        billing: "Billing & invoices",
                        devices: "Device preferences",
                        notifications: "Alerts & reminders",
                        users: "Access policy preferences",
                        integrations: "Integrations",
                        features: "Feature toggles",
                        data: "Data preferences",
                    }[section]
                }
            </Text>
            <Text style={[s.note, { color: c.textSecondary }]}>
                {localOnly
                    ? "These preferences apply to this device and are saved locally."
                    : editable
                      ? "Edit settings and save. Changes stay available offline and sync in the background."
                      : "Business settings are read-only here. An authorized administrator can edit them in the Admin app."}
            </Text>
            {["users", "notifications", "integrations", "data"].includes(
                section,
            ) && (
                <Text style={[s.note, { color: c.textSecondary }]}>
                    These are saved preferences. Server access rules, scheduled
                    notifications, backup jobs and connected integrations remain
                    controlled by their services. No credentials are stored in
                    this form.
                </Text>
            )}
            {fields.map((field) => (
                <View
                    key={field.key}
                    style={[s.field, { borderColor: c.outlineMuted }]}
                >
                    {field.kind === "toggle" ? (
                        <View style={s.toggleRow}>
                            <Text
                                style={[
                                    s.label,
                                    s.toggleLabel,
                                    { color: c.text },
                                ]}
                            >
                                {field.label}
                            </Text>
                            <SettingsToggle
                                accessibilityLabel={field.label}
                                value={values[field.key] === true}
                                isDisabled={!editable || busy}
                                onValueChange={(value) =>
                                    change(field.key, value)
                                }
                                trackColor={{
                                    false: c.outlineMuted,
                                    true: c.primarySoft,
                                }}
                                thumbColor={
                                    values[field.key]
                                        ? c.primary
                                        : c.textSecondary
                                }
                            />
                        </View>
                    ) : field.kind === "select" ? (
                        <>
                            <Text style={[s.label, { color: c.text }]}>
                                {field.label}
                            </Text>
                            <SettingsSelect
                                label={field.label}
                                value={String(values[field.key] ?? "")}
                                options={(field.options ?? []).map((value) => ({
                                    value,
                                    label: value,
                                }))}
                                disabled={!editable || busy}
                                onChange={(value) => change(field.key, value)}
                            />
                        </>
                    ) : (
                        <>
                            <Text style={[s.label, { color: c.text }]}>
                                {field.label}
                                {field.required ? " *" : ""}
                            </Text>
                            <TextInput
                                accessibilityLabel={field.label}
                                value={String(values[field.key] ?? "")}
                                editable={editable && !busy}
                                onChangeText={(value) =>
                                    change(field.key, value)
                                }
                                keyboardType={
                                    field.kind === "number"
                                        ? "decimal-pad"
                                        : /email/i.test(field.key)
                                          ? "email-address"
                                          : "default"
                                }
                                autoCapitalize="none"
                                style={[
                                    s.input,
                                    {
                                        color: c.text,
                                        borderColor: c.outlineMuted,
                                    },
                                ]}
                            />
                        </>
                    )}
                    {field.help && (
                        <Text style={[s.note, { color: c.textSecondary }]}>
                            {field.help}
                        </Text>
                    )}
                </View>
            ))}
            {!!(error || table.error) && (
                <Text accessibilityRole="alert" style={{ color: c.error }}>
                    {error || table.error}
                </Text>
            )}
            <Text
                accessibilityLiveRegion="polite"
                style={[s.note, { color: c.textSecondary }]}
            >
                {Object.keys(draft).length
                    ? "Unsaved changes"
                    : record?.syncStatus === "PENDING"
                      ? "Saved locally · pending sync"
                      : record?.syncStatus === "FAILED"
                        ? "Sync failed · retry in Data & sync"
                        : record
                          ? "Saved settings"
                          : "No downloaded settings yet"}
            </Text>
            {editable && (
                <View style={s.actions}>
                    <AppPressable
                        disabled={busy || !Object.keys(draft).length}
                        onPress={() => {
                            setDraft({});
                            setError("");
                        }}
                        style={[
                            s.button,
                            { borderColor: c.outlineMuted, borderWidth: 1 },
                        ]}
                    >
                        <Text style={{ color: c.text }}>Discard changes</Text>
                    </AppPressable>
                    <AppPressable
                        disabled={busy || !Object.keys(draft).length}
                        onPress={() => void save()}
                        style={[
                            s.button,
                            {
                                backgroundColor: c.primary,
                                opacity:
                                    busy || !Object.keys(draft).length
                                        ? 0.5
                                        : 1,
                            },
                        ]}
                    >
                        <Text style={{ color: "#fff", fontWeight: "700" }}>
                            {busy ? "Saving…" : "Save settings"}
                        </Text>
                    </AppPressable>
                </View>
            )}
        </View>
    );
}
const s = StyleSheet.create({
    root: {
        width: "100%",
        maxWidth: 760,
        alignSelf: "center",
        paddingVertical: 16,
        gap: 10,
    },
    heading: { fontSize: 19, fontWeight: "800" },
    note: { fontSize: 12, lineHeight: 18 },
    field: {
        paddingVertical: 12,
        gap: 8,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    label: { fontSize: 14, fontWeight: "600" },
    toggleRow: {
        minHeight: 48,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
    },
    toggleLabel: { flex: 1 },
    input: { borderWidth: 1, borderRadius: 12, padding: 12, minHeight: 48 },
    actions: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
    button: {
        padding: 14,
        borderRadius: 12,
        minHeight: 48,
        alignItems: "center",
    },
});
