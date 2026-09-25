export type SettingsSection =
    | "general"
    | "appearance"
    | "billing"
    | "devices"
    | "notifications"
    | "users"
    | "integrations"
    | "features"
    | "data";
export type SettingField = {
    key: string;
    label: string;
    section: SettingsSection;
    kind: "text" | "number" | "toggle" | "select";
    options?: string[];
    min?: number;
    max?: number;
    required?: boolean;
    help?: string;
};
const text = (
    section: SettingsSection,
    key: string,
    label: string,
    required = false,
): SettingField => ({ section, key, label, kind: "text", required });
const toggle = (
    section: SettingsSection,
    key: string,
    label: string,
): SettingField => ({ section, key, label, kind: "toggle" });
const select = (
    section: SettingsSection,
    key: string,
    label: string,
    options: string[],
): SettingField => ({ section, key, label, kind: "select", options });
export const settingsFields: SettingField[] = [
    text("general", "businessName", "Business name", true),
    text("general", "businessNamePrefix", "Business prefix"),
    select("general", "businessType", "Business type", [
        "retail",
        "pharmacy",
        "restaurant",
        "supermarket",
        "wholesale",
        "service",
        "electronics",
    ]),
    text("general", "phone", "Business phone"),
    text("general", "email", "Business email"),
    text("general", "address", "Address"),
    text("general", "city", "City"),
    text("general", "state", "State"),
    text("general", "gstin", "GSTIN / tax ID"),
    text("general", "pan", "PAN"),
    select("general", "currency", "Currency", [
        "INR",
        "USD",
        "EUR",
        "GBP",
        "AED",
        "SGD",
    ]),
    text("general", "timezone", "Timezone", true),
    select("general", "dateFormat", "Date format", [
        "DD/MM/YYYY",
        "MM/DD/YYYY",
        "YYYY-MM-DD",
    ]),
    select("appearance", "theme", "Theme", ["light", "dark"]),
    select("appearance", "language", "Language", ["en", "ta", "hi"]),
    text("appearance", "primaryColor", "Brand color (#RRGGBB)"),
    text("billing", "invoicePrefix", "Invoice prefix"),
    {
        section: "billing",
        key: "defaultTaxRate",
        label: "Default tax rate (%)",
        kind: "number",
        min: 0,
        max: 100,
    },
    select("billing", "taxCalculation", "Tax calculation", [
        "inclusive",
        "exclusive",
    ]),
    ...[
        ["allowOrderDiscounts", "Allow order discounts"],
        ["allowItemDiscounts", "Allow item discounts"],
        ["allowNegativeQuantityBilling", "Allow negative stock billing"],
        ["roundOffTotal", "Round off totals"],
        ["autoPrintReceipt", "Print receipts automatically"],
        ["showLogoOnReceipt", "Show logo on receipt"],
        ["showGstinOnReceipt", "Show tax ID on receipt"],
    ].map(([key, label]) => toggle("billing", key, label)),
    ...[
        ["autoConnectPrinter", "Connect saved printer automatically"],
        ["printPreview", "Print preview"],
        ["enableBarcodeScanning", "Barcode scanning"],
        ["soundOnScan", "Scan sound"],
    ].map(([key, label]) => toggle("devices", key, label)),
    text("notifications", "notificationEmail", "Notification email"),
    ...[
        ["soundNotifications", "Notification sounds"],
        ["lowStockAlerts", "Low stock alerts"],
        ["dailySalesSummary", "Daily sales summary"],
        ["emailLowStockReports", "Email low-stock reports"],
        ["emailDailyReports", "Email daily reports"],
        ["taxFilingReminders", "Tax filing reminders"],
        ["paymentDueReminders", "Payment due reminders"],
        ["supplierInvoiceReminders", "Supplier invoice reminders"],
    ].map(([key, label]) => toggle("notifications", key, label)),
    {
        section: "users",
        key: "minPasswordLength",
        label: "Minimum password length",
        kind: "number",
        min: 8,
        max: 128,
        help: "Stored policy preference; the authentication service remains authoritative.",
    },
    select("users", "sessionTimeout", "Session timeout (minutes)", [
        "15",
        "30",
        "60",
        "120",
    ]),
    toggle("users", "requireLoginForBilling", "Require sign-in for billing"),
    toggle(
        "users",
        "restrictSettingsToAdmins",
        "Restrict business settings to administrators",
    ),
    toggle("users", "auditLogging", "Audit logging"),
    {
        ...text("integrations", "apiEndpoint", "Integration API endpoint"),
        help: "Integration destination only. This does not change the app’s authentication or POS server.",
    },
    text("integrations", "wsEndpoint", "Integration WebSocket endpoint"),
    toggle("data", "autoRefresh", "Refresh automatically"),
    {
        section: "data",
        key: "autoRefreshIntervalSeconds",
        label: "Refresh interval (seconds)",
        kind: "number",
        min: 15,
        max: 3600,
    },
    toggle("data", "autoBackup", "Automatic backup"),
    select("data", "backupFrequency", "Backup frequency", [
        "daily",
        "weekly",
        "monthly",
    ]),
    select(
        "data",
        "transactionLogRetention",
        "Transaction log retention (days)",
        ["30", "90", "180", "365"],
    ),
    toggle("data", "keepAuditLogs", "Retain audit logs"),
];
export type SettingsValues = Record<string, string | number | boolean>;
for (const [key, label] of Object.entries(featureToggleLabels)) {
    if (!settingsFields.some((field) => field.key === key))
        settingsFields.push(toggle("features", key, label));
}
export type SettingsRecord = {
    id: string;
    values: SettingsValues;
    patch?: SettingsValues;
};

export function validateSettingsPatch(
    patch: SettingsValues,
    fields = settingsFields,
): SettingsValues {
    const result: SettingsValues = {};
    for (const [key, raw] of Object.entries(patch)) {
        const field = fields.find((item) => item.key === key);
        if (!field) throw new Error(`Unsupported setting: ${key}`);
        const value = typeof raw === "string" ? raw.trim() : raw;
        if (
            (field.kind === "text" || field.kind === "select") &&
            typeof value !== "string"
        )
            throw new Error(`${field.label} must be text.`);
        if (typeof value === "string" && value.length > 1000)
            throw new Error(`${field.label} is too long.`);
        if (field.required && !String(value).trim())
            throw new Error(`${field.label} is required.`);
        if (field.kind === "toggle" && typeof value !== "boolean")
            throw new Error(`${field.label} must be on or off.`);
        if (
            field.kind === "number" &&
            (value === "" ||
                !Number.isFinite(Number(value)) ||
                Number(value) < (field.min ?? -Infinity) ||
                Number(value) > (field.max ?? Infinity))
        )
            throw new Error(
                `${field.label} must be between ${field.min} and ${field.max}.`,
            );
        if (field.kind === "select" && !field.options?.includes(String(value)))
            throw new Error(`Choose a valid ${field.label.toLowerCase()}.`);
        if (
            /email/i.test(key) &&
            value &&
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value))
        )
            throw new Error(`${field.label} is invalid.`);
        if (key === "timezone" && value) {
            try {
                new Intl.DateTimeFormat("en", { timeZone: String(value) });
            } catch {
                throw new Error(
                    "Enter a valid timezone, such as Asia/Kolkata.",
                );
            }
        }
        if (
            key === "primaryColor" &&
            value &&
            !/^#[\da-f]{6}$/i.test(String(value))
        )
            throw new Error("Brand color must use #RRGGBB.");
        if ((key === "apiEndpoint" || key === "wsEndpoint") && value) {
            try {
                const url = new URL(String(value));
                if (
                    !(key === "apiEndpoint" ? ["https:"] : ["wss:"]).includes(
                        url.protocol,
                    ) ||
                    url.username ||
                    url.password
                )
                    throw new Error();
            } catch {
                throw new Error(
                    `${field.label} must use a secure URL without credentials.`,
                );
            }
        }
        result[key] = field.kind === "number" ? Number(value) : value;
    }
    return result;
}
import { featureToggleLabels } from "@indyzai/feature-flags";
