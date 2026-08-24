import { PrismaClient } from '@prisma/client';

/**
 * Prisma singleton.
 *
 * Next dev-mode hot reload re-evaluates modules on every edit, which would open
 * a new connection pool each time and eventually exhaust SQLite's file locks.
 * Stashing the client on `globalThis` keeps exactly one instance alive across
 * reloads. In production the module is evaluated once, so the global is unused.
 */

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? [{ emit: 'stdout', level: 'warn' }, { emit: 'stdout', level: 'error' }]
        : [{ emit: 'stdout', level: 'error' }],
  });

// Alias for backward compatibility
export const prisma = db;

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = db;
}

/**
 * Run a function inside a serialised transaction.
 *
 * Money-moving flows (wallet credit/debit, payout approval, commission release,
 * checkout) must use this rather than bare `db.$transaction`, because the
 * default timeout is too short for the multi-step wallet writes and a silent
 * timeout would leave a ledger row without its balance update.
 */
export async function tx<T>(fn: (client: PrismaTx) => Promise<T>): Promise<T> {
  return db.$transaction(fn, {
    maxWait: 10_000,
    timeout: 30_000,
  });
}

/** The transactional client type — same surface as `db` minus `$transaction`. */
export type PrismaTx = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

/** Accepts either the root client or a transaction client. */
export type DbClient = PrismaTx | PrismaClient;
