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

// Warn if connection pool is too small — homepage fires 6 parallel queries.
if (process.env.DATABASE_URL?.includes('connection_limit=1')) {
  console.warn(
    '[Prisma] WARNING: connection_limit=1 detected in DATABASE_URL. ' +
    'This WILL cause pool exhaustion on pages with parallel queries. ' +
    'Set connection_limit=5&pool_timeout=20 instead.'
  );
}

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
