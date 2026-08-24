import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCustomerSession, requireCustomer } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { apiOk, apiError } from '@/lib/api';

export const dynamic = 'force-dynamic';

const BankAccountSchema = z.object({
  accountHolderName: z.string().min(2),
  accountNumber: z.string().min(9).max(18),
  ifsc: z.string().regex(/^[A-Z]{4}0[A-Z0-9]{6}$/i),
  accountType: z.enum(['savings', 'current']).default('savings'),
  isDefault: z.boolean().default(false),
});

export async function GET(request: NextRequest) {
  const session = await requireCustomer();

  try {
    const accounts = await db.bankAccount.findMany({
      where: { userId: session.userId, archivedAt: null },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        kind: true,
        accountHolderName: true,
        accountNumberLast4: true,
        ifsc: true,
        bankName: true,
        branch: true,
        accountType: true,
        verificationStatus: true,
        nameMatchScore: true,
        registeredName: true,
        isDefault: true,
        createdAt: true,
        verifiedAt: true,
        failureReason: true,
      },
    });

    return apiOk({ data: accounts });
  } catch (error) {
    console.error('Bank accounts error:', error);
    return apiError('INTERNAL_ERROR', 'Failed to load bank accounts', 500);
  }
}

export async function POST(request: NextRequest) {
  const session = await requireCustomer();

  try {
    const body = await request.json();
    const parsed = BankAccountSchema.safeParse(body);
    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', 'Validation failed', 400, { details: parsed.error.flatten().fieldErrors });
    }

    // Encrypt account number
    const { encryptFieldSync } = await import('@/lib/crypto');
    const accountNumberEnc = encryptFieldSync(parsed.data.accountNumber);
    const accountNumberLast4 = parsed.data.accountNumber.slice(-4);

    // IFSC lookup
    const { lookupIfscShared } = await import('@/lib/adapters/verification/ifsc');
    const ifscData = await lookupIfscShared(parsed.data.ifsc);

    if (parsed.data.isDefault) {
      await db.bankAccount.updateMany({
        where: { userId: session.userId, isDefault: true },
        data: { isDefault: false },
      });
    }

    const account = await db.bankAccount.create({
      data: {
        userId: session.userId,
        kind: 'bank',
        accountHolderName: parsed.data.accountHolderName,
        accountNumberEnc,
        accountNumberLast4,
        ifsc: parsed.data.ifsc.toUpperCase(),
        bankName: ifscData?.bank,
        branch: ifscData?.branch,
        accountType: parsed.data.accountType,
        isDefault: parsed.data.isDefault,
        verificationStatus: 'unverified',
      },
      select: { id: true },
    });

    // Trigger verification
    // The account is created with 'unverified' status. Verification can be triggered
    // by the customer from their account page, or by an admin.
    // await verifyBankAccount(account.id, session.userId).catch(console.error);

    return apiOk({ data: { id: account.id, verificationStatus: 'unverified' } }, { status: 201 });
  } catch (error) {
    console.error('Add bank account error:', error);
    return apiError('INTERNAL_ERROR', 'Failed to add bank account', 500);
  }
}