export type AuthTenant = { id: string; name: string; role: string };

export type AuthUser = {
    id: string;
    email: string;
    firstName?: string | null;
    lastName?: string | null;
    avatarUrl?: string | null;
    role?: string;
    tenants?: AuthTenant[];
};

export type LoginCredentials = { email: string; password: string };

export type RegistrationPayload = {
    fullName: string;
    email: string;
    password: string;
    companyName: string;
    domainName: string;
    organizationType: string;
    industry: string;
};

export type DeviceRegistrationDetails = {
    registered: boolean;
    deviceId?: string;
    deviceIdentifier?: string;
    deviceName: string;
    platform: string;
    platformVersion: string;
    applicationId: string;
    applicationVersion: string;
    buildVersion: string;
    executionEnvironment: string;
};
