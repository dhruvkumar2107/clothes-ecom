import { PERMISSIONS, type Permission } from '../enums';

/**
 * Staff permission checks.
 *
 * Roles hold a CSV string rather than a join table, which keeps a role editable
 * in one write and makes the seed readable. The cost is that matching has to be
 * done here rather than by the database, so this file is the only place that
 * knows the grammar:
 *
 *   `*`              — everything (the Owner role)
 *   `orders.*`       — every verb on one resource
 *   `orders.read`    — exactly that
 *
 * The wildcard forms exist because the alternative is a role definition that
 * has to be edited every time a new permission is added to the catalogue — and
 * the failure mode there is silent: a new admin screen appears that the
 * "Manager" role mysteriously cannot open.
 */

/** Parse a role's CSV into a de-duplicated list, ignoring blanks. */
export function parsePermissions(csv: string | null | undefined): string[] {
  if (!csv) return [];
  const seen = new Set<string>();
  for (const raw of csv.split(',')) {
    const value = raw.trim();
    if (value) seen.add(value);
  }
  return [...seen];
}

export function serializePermissions(permissions: readonly string[]): string {
  return [...new Set(permissions.map((p) => p.trim()).filter(Boolean))].join(',');
}

/**
 * Does this set of grants satisfy `required`?
 *
 * Note the deliberate asymmetry: a grant may be a wildcard, but `required`
 * never is. Callers ask "may this person do X" about a specific action, so
 * accepting a wildcard on the asking side would let a caller accidentally
 * check `orders.*` and get true from a read-only grant.
 */
export function hasPermission(
  grants: readonly string[] | string | null | undefined,
  required: Permission | string,
): boolean {
  const list = typeof grants === 'string' ? parsePermissions(grants) : (grants ?? []);
  if (list.length === 0) return false;
  if (list.includes('*')) return true;
  if (list.includes(required)) return true;

  const dot = required.indexOf('.');
  if (dot > 0) {
    const resource = required.slice(0, dot);
    if (list.includes(`${resource}.*`)) return true;
  }
  return false;
}

/** True when every one of `required` is granted. */
export function hasAllPermissions(
  grants: readonly string[] | string | null | undefined,
  required: readonly (Permission | string)[],
): boolean {
  return required.every((r) => hasPermission(grants, r));
}

/** True when at least one of `required` is granted. */
export function hasAnyPermission(
  grants: readonly string[] | string | null | undefined,
  required: readonly (Permission | string)[],
): boolean {
  return required.some((r) => hasPermission(grants, r));
}

/**
 * Expand wildcards into the concrete catalogue — used by the role editor so the
 * permission matrix shows an Owner's checkboxes as ticked rather than empty.
 */
export function expandPermissions(
  grants: readonly string[] | string | null | undefined,
): Permission[] {
  const list = typeof grants === 'string' ? parsePermissions(grants) : (grants ?? []);
  if (list.includes('*')) return [...PERMISSIONS];
  return PERMISSIONS.filter((p) => hasPermission(list, p));
}

/** Drop anything not in the catalogue. Keeps a hand-edited CSV from granting typos. */
export function sanitizePermissions(input: readonly string[]): string[] {
  const catalogue = new Set<string>(PERMISSIONS);
  return input.filter(
    (p) => p === '*' || catalogue.has(p) || (p.endsWith('.*') && PERMISSIONS.some((c) => c.startsWith(p.slice(0, -1)))),
  );
}

/**
 * The system roles, created by the seed and undeletable.
 *
 * Support deliberately cannot approve payouts or refund payments — the two
 * actions that move money outward and are the usual target of a compromised
 * support account.
 */
export const SYSTEM_ROLES: {
  name: string;
  slug: string;
  description: string;
  permissions: string[];
}[] = [
  {
    name: 'Owner',
    slug: 'owner',
    description: 'Unrestricted access, including settings and payout approval.',
    permissions: ['*'],
  },
  {
    name: 'Manager',
    slug: 'manager',
    description: 'Runs the store day to day. No staff management or gateway keys.',
    permissions: [
      'dashboard.view',
      'products.*',
      'inventory.write',
      'orders.*',
      'shipping.write',
      'customers.read',
      'customers.write',
      'discounts.*',
      'cms.*',
      'marketing.*',
      'returns.*',
      'reviews.moderate',
      'payments.read',
      'payments.refund',
      'referrals.read',
      'wallet.read',
      'payouts.read',
      'reports.view',
      'reports.export',
      'settings.read',
    ],
  },
  {
    name: 'Support',
    slug: 'support',
    description: 'Answers customers. Read-mostly; cannot move money or ban users.',
    permissions: [
      'dashboard.view',
      'products.read',
      'orders.read',
      'orders.write',
      'customers.read',
      'returns.read',
      'returns.write',
      'reviews.moderate',
      'payments.read',
      'wallet.read',
      'payouts.read',
      'discounts.read',
    ],
  },
  {
    name: 'Finance',
    slug: 'finance',
    description: 'Payments, payouts, referral commission and tax reporting.',
    permissions: [
      'dashboard.view',
      'orders.read',
      'customers.read',
      'payments.read',
      'payments.refund',
      'referrals.read',
      'referrals.write',
      'wallet.read',
      'wallet.adjust',
      'payouts.read',
      'payouts.approve',
      'payouts.retry',
      'reports.view',
      'reports.export',
      'settings.read',
    ],
  },
];
