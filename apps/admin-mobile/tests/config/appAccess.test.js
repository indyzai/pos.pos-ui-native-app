import { describe, expect, test } from 'bun:test';
import { canAccessApp } from '../../src/config/appAccess.js';

describe('administration app access', () => {
    test('accepts tenant users and administrators', () => {
        expect(canAccessApp('admin')).toBe(true);
        expect(canAccessApp('OWNER')).toBe(true);
        expect(canAccessApp('member', 'user')).toBe(true);
        expect(canAccessApp('guest', 'user')).toBe(true);
        expect(canAccessApp('member', 'superadmin')).toBe(true);
        expect(canAccessApp('manager', 'super-admin')).toBe(true);
    });

    test('rejects store-only and unknown roles', () => {
        expect(canAccessApp('cashier')).toBe(false);
        expect(canAccessApp('manager')).toBe(false);
        expect(canAccessApp('unexpected-role')).toBe(false);
    });
});
