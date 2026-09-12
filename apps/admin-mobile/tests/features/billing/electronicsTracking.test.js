import { expect, test } from 'bun:test';
import {
    requiresDeviceDetails,
    validateTrackedDevices,
} from '../../../src/features/billing/domain/electronicsTracking';

const device = (id, serial) => ({
    id,
    name: `Device ${id}`,
    category: 'Electronics',
    price: 100,
    stock: 2,
    emoji: '📱',
    color: '#fff',
    quantity: 1,
    details: { serialRequired: true },
    customization: serial
        ? { key: `device:${serial}`, metadata: { serialNumber: serial, warrantyMonths: 12 } }
        : undefined,
});

test('requires capture for serial-tracked or warrantied products', () => {
    expect(requiresDeviceDetails(device('1'))).toBe(true);
    expect(requiresDeviceDetails({ ...device('1'), details: {} })).toBe(false);
    expect(requiresDeviceDetails({ ...device('1'), details: { warrantyMonths: 12 } })).toBe(true);
});

test('rejects missing and duplicate serial numbers', () => {
    expect(validateTrackedDevices([device('1')])).toContain('Device 1');
    expect(validateTrackedDevices([device('1', 'ABC'), device('2', 'abc')])).toContain('already');
    expect(validateTrackedDevices([device('1', 'ABC'), device('2', 'DEF')])).toBeUndefined();
});
