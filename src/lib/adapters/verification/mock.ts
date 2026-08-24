import { lookupIfscShared } from './ifsc';
import {
  bankFromIfsc,
  isValidAccountNumberFormat,
  isValidVpaFormat,
  matchNames,
} from './name-match';
import { GatewayError, type BankVerificationResult, type BankVerifier, type IfscDetails } from '../types';

/**
 * Mock penny-drop verifier.
 *
 * This is deliberately *not* a stub that returns `verified` instantly. A real
 * penny-drop is asynchronous — you POST an account, get `pending`, and the
 * terminal state arrives seconds to minutes later by webhook or polling. Any UI
 * built against a synchronous fake breaks the day real keys are added, which is
 * the exact failure this driver exists to prevent.
 *
 * So it models the real machine:
 *
 *   verifyBankAccount()  → { status: 'pending' }              (immediately)
 *   fetchVerification()  → 'pending' → 'processing' → terminal (time-based)
 *
 * Outcomes are deterministic, driven by the account number, so every branch of
 * the withdrawal flow is reachable in development without touching code:
 *
 *   …0000  →  failed: account does not exist
 *   …1111  →  failed: name mismatch (bank returns a different person)
 *   …2222  →  verified with a *partial* name match (extra middle name)
 *   …3333  →  failed: account frozen / inactive
 *   …9999  →  never settles — stays pending, for testing the timeout path
 *   else   →  verified, exact name match, ₹1 deposited, synthetic UTR
 *
 * State is encoded in the reference id rather than held in memory, so a dev
 * server restart mid-verification still resolves correctly.
 */

const PENDING_MS = 4_000; // pending → processing
const SETTLE_MS = 9_000; // processing → terminal

type MockOutcome =
  | 'verified'
  | 'name_mismatch'
  | 'partial_name'
  | 'not_found'
  | 'frozen'
  | 'never';

function outcomeFor(accountNumber: string): MockOutcome {
  const tail = accountNumber.replace(/\D/g, '').slice(-4);
  switch (tail) {
    case '0000':
      return 'not_found';
    case '1111':
      return 'name_mismatch';
    case '2222':
      return 'partial_name';
    case '3333':
      return 'frozen';
    case '9999':
      return 'never';
    default:
      return 'verified';
  }
}

interface RefPayload {
  /** Initiation time, so elapsed-time state transitions work statelessly. */
  t: number;
  /** Last 4 of the account — drives the deterministic outcome. */
  a: string;
  /** The claimed holder name, needed to compute the match on fetch. */
  n: string;
  /** IFSC, for bank/branch echo. */
  i: string;
  kind: 'bank' | 'upi';
}

function encodeRef(payload: RefPayload): string {
  const json = JSON.stringify(payload);
  const b64 = Buffer.from(json, 'utf8').toString('base64url');
  return `pd_mock_${b64}`;
}

function decodeRef(ref: string): RefPayload | null {
  if (!ref.startsWith('pd_mock_')) return null;
  try {
    const json = Buffer.from(ref.slice('pd_mock_'.length), 'base64url').toString('utf8');
    const parsed = JSON.parse(json) as RefPayload;
    if (typeof parsed.t !== 'number' || typeof parsed.a !== 'string') return null;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Synthesize the name the "bank" holds on file. The perturbations are chosen to
 * exercise the real matcher rather than trivially agree with it.
 */
function registeredNameFor(claimed: string, outcome: MockOutcome): string {
  const upper = claimed.toUpperCase().trim();

  switch (outcome) {
    case 'name_mismatch':
      return 'SUNIL KUMAR VERMA';
    case 'partial_name': {
      // Insert a middle name the customer didn't type — extremely common in
      // reality, and should still clear a sensible threshold.
      const parts = upper.split(/\s+/);
      if (parts.length >= 2) {
        return [parts[0], 'KUMAR', ...parts.slice(1)].join(' ');
      }
      return `${upper} KUMAR`;
    }
    default:
      return upper;
  }
}

/** Deterministic pseudo-UTR so ledger screens have realistic-looking data. */
function syntheticUtr(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) % 1_000_000_000_000;
  }
  return `MOCK${String(hash).padStart(12, '0')}`;
}

export class MockVerifier implements BankVerifier {
  readonly name = 'mock';
  readonly mode = 'mock' as const;
  readonly label = 'Mock bank verification';

  async verifyBankAccount(input: {
    accountNumber: string;
    ifsc: string;
    accountHolderName: string;
    contactId?: string;
    referenceId: string;
    idempotencyKey: string;
  }): Promise<BankVerificationResult> {
    const accountNumber = input.accountNumber.replace(/\s/g, '');

    // Shape validation happens even in mock: a malformed account number must be
    // rejected here, not silently "verified".
    if (!isValidAccountNumberFormat(accountNumber)) {
      throw new GatewayError({
        code: 'account_invalid',
        message: 'mock: account number must be 9–18 digits',
        provider: 'mock',
        retryable: false,
        userMessage: 'That account number does not look right. Please check your passbook.',
      });
    }

    // Real IFSC validation against the public directory — see ./ifsc.ts.
    const branch = await lookupIfscShared(input.ifsc);
    if (!branch) {
      throw new GatewayError({
        code: 'invalid_ifsc',
        message: `mock: IFSC ${input.ifsc} not found in the branch directory`,
        provider: 'mock',
        retryable: false,
        userMessage: 'That IFSC code could not be found. Please check and try again.',
      });
    }

    const ref = encodeRef({
      t: Date.now(),
      a: accountNumber.slice(-4),
      n: input.accountHolderName,
      i: input.ifsc.toUpperCase(),
      kind: 'bank',
    });

    // Exactly like the real thing: return pending, settle later.
    return {
      providerRefId: ref,
      status: 'pending',
      amountDeposited: null,
      bankName: branch.bank,
      branch: branch.branch,
      raw: {
        driver: 'mock',
        note: 'Penny-drop queued. Poll fetchVerification or wait for the webhook.',
        settlesInMs: SETTLE_MS,
        deterministicOutcome: outcomeFor(accountNumber),
      },
    };
  }

  async fetchVerification(providerRefId: string): Promise<BankVerificationResult> {
    const payload = decodeRef(providerRefId);
    if (!payload) {
      throw new GatewayError({
        code: 'not_found',
        message: `mock: unknown verification reference ${providerRefId}`,
        provider: 'mock',
        retryable: false,
      });
    }

    const elapsed = Date.now() - payload.t;
    const outcome = outcomeFor(payload.a);
    const branch = await lookupIfscShared(payload.i);

    const base = {
      providerRefId,
      bankName: branch?.bank ?? bankFromIfsc(payload.i),
      branch: branch?.branch ?? null,
    };

    if (outcome === 'never') {
      return {
        ...base,
        status: 'pending',
        raw: { driver: 'mock', note: 'Test account …9999 never settles.' },
      };
    }

    if (elapsed < PENDING_MS) {
      return { ...base, status: 'pending', raw: { driver: 'mock', elapsed } };
    }
    if (elapsed < SETTLE_MS) {
      return { ...base, status: 'processing', raw: { driver: 'mock', elapsed } };
    }

    if (outcome === 'not_found') {
      return {
        ...base,
        status: 'failed',
        failureReason: 'Account does not exist at the given IFSC',
        raw: { driver: 'mock', code: 'BENEFICIARY_ACCOUNT_INVALID' },
      };
    }
    if (outcome === 'frozen') {
      return {
        ...base,
        status: 'failed',
        failureReason: 'Beneficiary account is inactive or frozen',
        raw: { driver: 'mock', code: 'BENEFICIARY_ACCOUNT_FROZEN' },
      };
    }

    const registeredName = registeredNameFor(payload.n, outcome);
    const match = matchNames(payload.n, registeredName);

    // A penny-drop that lands but returns the wrong name is a *failed*
    // verification, not a successful one with a low score. Enforcing the
    // threshold is the service layer's job (it reads wallet.nameMatchThreshold),
    // so the driver reports the facts and lets policy decide — except for a
    // flat-out different person, which no threshold should accept.
    const status: BankVerificationResult['status'] =
      match.result === 'mismatch' ? 'failed' : 'verified';

    return {
      ...base,
      status,
      registeredName,
      nameMatchScore: match.score,
      nameMatchResult: match.result,
      amountDeposited: status === 'verified' ? 100 : null,
      utr: status === 'verified' ? syntheticUtr(providerRefId) : null,
      failureReason:
        status === 'failed'
          ? `Name on account (${registeredName}) does not match the name provided`
          : null,
      raw: {
        driver: 'mock',
        matchExplanation: match.explanation,
        elapsed,
      },
    };
  }

  async verifyVpa(input: {
    vpa: string;
    accountHolderName: string;
    referenceId: string;
  }): Promise<BankVerificationResult> {
    const vpa = input.vpa.trim().toLowerCase();

    if (!isValidVpaFormat(vpa)) {
      throw new GatewayError({
        code: 'invalid_vpa',
        message: 'mock: malformed VPA',
        provider: 'mock',
        retryable: false,
        userMessage: 'That UPI ID does not look valid. It should look like name@bank.',
      });
    }

    // VPA validation genuinely is synchronous at every real provider — the PSP
    // answers from its directory — so unlike a penny-drop this returns terminal.
    const handle = vpa.split('@')[0];

    if (handle.startsWith('invalid') || handle === 'notfound') {
      return {
        providerRefId: `vpa_mock_${Buffer.from(vpa).toString('base64url')}`,
        status: 'failed',
        failureReason: 'VPA does not exist',
        raw: { driver: 'mock', code: 'VPA_NOT_FOUND' },
      };
    }

    const registeredName = handle.startsWith('mismatch')
      ? 'ANOTHER PERSON'
      : input.accountHolderName.toUpperCase();
    const match = matchNames(input.accountHolderName, registeredName);

    return {
      providerRefId: `vpa_mock_${Buffer.from(vpa).toString('base64url')}`,
      status: match.result === 'mismatch' ? 'failed' : 'verified',
      registeredName,
      nameMatchScore: match.score,
      nameMatchResult: match.result,
      bankName: vpa.split('@')[1] ?? null,
      raw: { driver: 'mock', matchExplanation: match.explanation },
    };
  }

  lookupIfsc(ifsc: string): Promise<IfscDetails | null> {
    return lookupIfscShared(ifsc);
  }

  verifyWebhookSignature(): boolean {
    // No signing secret exists in mock mode. The webhook route additionally
    // refuses mock-signed payloads unless the resolved driver is the mock, so
    // this cannot become a production bypass.
    return true;
  }
}
