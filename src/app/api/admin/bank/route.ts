import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth/admin';
import { db } from '@/lib/db';
import { apiOk, apiError, parseQuery } from '@/lib/api';
import { getBankVerifier } from '@/lib/adapters/registry';

export const dynamic = 'force-dynamic';

const BankListSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['unverified', 'pending', 'verified', 'failed']).optional(),
  userId: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(['payouts.read']);
    const params = parseQuery(request, BankListSchema);

    const where: any = {};
    if (params.status) where.verificationStatus = params.status;
    if (params.userId) where.userId = params.userId;

    const page = params.page ?? 1;
    const limit = params.limit ?? 20;

    const [accounts, total] = await Promise.all([
      db.bankAccount.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          user: { select: { id: true, name: true, email: true } },
          verifications: { orderBy: { createdAt: 'desc' }, take: 1 },
        },
      }),
      db.bankAccount.count({ where }),
    ]);

    return apiOk({ data: accounts, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (error: any) {
    if (error?.code) return apiError(error.code, error.message, error.status || 500);
    console.error('Admin bank accounts error:', error);
    return apiError('INTERNAL_ERROR', 'Failed to load bank accounts', 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin(['payouts.approve']);
    const body = await request.json();
    const { accountId, action } = body;

    if (action === 'verify') {
      const account = await db.bankAccount.findUnique({ where: { id: accountId } });
      if (!account) return apiError('NOT_FOUND', 'Bank account not found', 404);

const verifier = getBankVerifier();
      const result = await verifier.verifyBankAccount({
        accountHolderName: account.accountHolderName,
        accountNumber: account.accountNumberEnc!,
        ifsc: account.ifsc!,
        referenceId: account.id,
        idempotencyKey: `verify:${account.id}:${Date.now()}`,
      });

      await db.bankAccount.update({
        where: { id: accountId },
        data: {
          verificationStatus: result.status === 'verified' ? 'verified' : 'failed',
          nameMatchScore: result.nameMatchScore,
          registeredName: result.registeredName,
          verifiedAt: result.status === 'verified' ? new Date() : null,
          failureReason: result.status === 'verified' ? null : result.failureReason,
          providerRefId: result.providerRefId,
        },
      });

      await db.bankVerification.create({
        data: {
          bankAccountId: accountId,
          userId: account.userId,
          provider: verifier.name || 'unknown',
          mode: 'penny_drop',
          status: result.status === 'verified' ? 'verified' : 'failed',
          providerRefId: result.providerRefId,
          registeredName: result.registeredName,
          nameMatchScore: result.nameMatchScore,
          nameMatchResult: result.nameMatchScore !== null && result.nameMatchScore !== undefined ? (result.nameMatchScore > 80 ? 'exact' : result.nameMatchScore > 50 ? 'partial' : 'mismatch') : undefined,
          failureReason: result.failureReason,
          triggeredBy: 'admin',
        },
      });

      return apiOk({ data: { verified: result.status === 'verified', result } });
    }

    if (action === 'retry_verification') {
      const account = await db.bankAccount.findUnique({ where: { id: accountId } });
      if (!account) return apiError('NOT_FOUND', 'Bank account not found', 404);

      const verifier = getBankVerifier();
      const result = await verifier.verifyBankAccount({
        accountHolderName: account.accountHolderName,
        accountNumber: account.accountNumberEnc!,
        ifsc: account.ifsc!,
        referenceId: account.id,
        idempotencyKey: `retry-verify:${account.id}:${Date.now()}`,
      });

      await db.bankAccount.update({
        where: { id: accountId },
        data: {
          verificationStatus: result.status === 'verified' ? 'verified' : result.status === 'failed' ? 'failed' : 'pending',
          nameMatchScore: result.nameMatchScore,
          registeredName: result.registeredName,
          verifiedAt: result.status === 'verified' ? new Date() : null,
          failureReason: result.status === 'verified' ? null : result.failureReason,
          providerRefId: result.providerRefId,
        },
      });

      await db.bankVerification.create({
        data: {
          bankAccountId: accountId,
          userId: account.userId,
          provider: verifier.name || 'unknown',
          mode: 'penny_drop',
          status: result.status === 'verified' ? 'verified' : result.status === 'failed' ? 'failed' : 'pending',
          providerRefId: result.providerRefId,
          registeredName: result.registeredName,
          nameMatchScore: result.nameMatchScore,
          failureReason: result.failureReason,
          triggeredBy: 'admin',
        },
      });

      return apiOk({ data: { retried: true, result } });
    }

    return apiError('INVALID_ACTION', 'Unknown action', 400);
  } catch (error: any) {
    if (error?.code) return apiError(error.code, error.message, error.status || 500);
    console.error('Admin bank action error:', error);
    return apiError('INTERNAL_ERROR', 'Failed to process bank action', 500);
  }
}