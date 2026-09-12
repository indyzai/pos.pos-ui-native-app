import { posRoles, type PosRole } from '@indyzai/pos-database';

export const allowedAppRoles: readonly PosRole[] = ['cashier', 'manager'];

export function canAccessApp(role: unknown): boolean {
  const normalized = String(role ?? '')
    .trim()
    .toLowerCase() as PosRole;
  return posRoles.includes(normalized) && allowedAppRoles.includes(normalized);
}
