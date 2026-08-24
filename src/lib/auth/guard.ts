import { db, type DbClient } from '../db';
import { writeJson } from '../json';
import type { Permission } from '../enums';
import { hasAnyPermission, hasPermission } from './permissions';
import {
  ForbiddenError,
  AuthRequiredError,
  getStaffSession,
  requestContext,
  type StaffSessionInfo,
} from './session';

/**
 * Admin-side guards and the audit trail.
 *
 * Every admin page and API route goes through `requireStaff` or
 * `requirePermission`. The guard returns the session so the caller has the
 * actor's identity to hand — which matters because the audit log is not
 * optional decoration for money-moving actions, and a guard that returns
 * nothing quietly encourages writing audit rows with `actorLabel: 'admin'`.
 */

export async function requireStaff(): Promise<StaffSessionInfo> {
  const session = await getStaffSession();
  if (!session) throw new AuthRequiredError('Please sign in to the admin panel.');
  return session;
}

export async function requirePermission(permission: Permission): Promise<StaffSessionInfo> {
  const session = await requireStaff();
  if (!hasPermission(session.permissions, permission)) {
    throw new ForbiddenError(
      `Your role (${session.roleName}) does not include "${permission}".`,
      permission,
    );
  }
  return session;
}

export async function requireAnyPermission(
  permissions: readonly Permission[],
): Promise<StaffSessionInfo> {
  const session = await requireStaff();
  if (!hasAnyPermission(session.permissions, permissions)) {
    throw new ForbiddenError(
      `Your role (${session.roleName}) does not include any of: ${permissions.join(', ')}.`,
      permissions[0],
    );
  }
  return session;
}

/** Non-throwing check for conditional UI — hide a button rather than 403 on click. */
export async function can(permission: Permission): Promise<boolean> {
  const session = await getStaffSession();
  return session ? hasPermission(session.permissions, permission) : false;
}

// ── audit ───────────────────────────────────────────────────────────────────

export type ActorType = 'staff' | 'customer' | 'system' | 'webhook';

export interface AuditInput {
  action: string;
  entity: string;
  entityId?: string | null;
  summary?: string;
  /** Before/after pairs, or any structured context. Serialised safely. */
  diff?: unknown;
  actorType?: ActorType;
  staffId?: string | null;
  actorLabel?: string | null;
  ip?: string | null;
}

/**
 * Write an audit row.
 *
 * Never throws. An audit failure must not roll back the action it describes —
 * losing the record of a completed payout is bad, but failing the payout *after*
 * the money left because the log write hit a constraint is worse, and leaves the
 * system in a state nobody can reconcile.
 *
 * Pass a transaction client when the audit row should be atomic with its action
 * (payout approval, commission override) — inside a transaction a swallowed
 * error is still visible as a missing row, whereas a thrown one would abort the
 * money movement.
 */
export async function audit(input: AuditInput, client: DbClient = db): Promise<void> {
  try {
    await client.auditLog.create({
      data: {
        actorType: input.actorType ?? (input.staffId ? 'staff' : 'system'),
        staffId: input.staffId ?? null,
        actorLabel: input.actorLabel ?? null,
        action: input.action,
        entity: input.entity,
        entityId: input.entityId ?? null,
        summary: input.summary ?? null,
        diffJson: input.diff === undefined ? null : writeJson(input.diff),
        ip: input.ip ?? null,
      },
    });
  } catch (error) {
    console.error(
      `[audit] failed to record ${input.action} on ${input.entity}${
        input.entityId ? `#${input.entityId}` : ''
      }: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/** Audit with the acting staff member and request IP filled in from context. */
export async function auditAs(
  session: StaffSessionInfo,
  input: Omit<AuditInput, 'actorType' | 'staffId' | 'actorLabel' | 'ip'>,
): Promise<void> {
  const ctx = await requestContext().catch(() => ({ ip: null }) as { ip: string | null });
  await audit({
    ...input,
    actorType: 'staff',
    staffId: session.staffId,
    actorLabel: `${session.name} (${session.roleName})`,
    ip: ctx.ip,
  });
}

/**
 * Guard + audit in one call, for the handful of actions where forgetting the
 * audit row is a compliance problem rather than an inconvenience.
 */
export async function requirePermissionAndAudit(
  permission: Permission,
  input: Omit<AuditInput, 'actorType' | 'staffId' | 'actorLabel' | 'ip'>,
): Promise<StaffSessionInfo> {
  const session = await requirePermission(permission);
  await auditAs(session, input);
  return session;
}
