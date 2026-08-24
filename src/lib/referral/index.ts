export {
  attributeSignup,
  lookupReferralCode,
  activeRule,
  ensureReferralCode,
  referralLink,
  type AttributionInput,
  type AttributionResult,
} from './attribution';

export {
  evaluateReferral,
  canonicalEmail,
  recordFlags,
  riskScore,
  blockingSignals,
  isReferralPayable,
  type FraudSignal,
  type FraudContext,
} from './fraud';

export {
  accrueForOrder,
  reverseForOrder,
  computeCommission,
  overrideCommission,
  type AccrualResult,
} from './commission';

export {
  releaseHeldCommissions,
} from './release';

export {
  getReferralDashboard,
  getReferralChain,
  getReferralStats,
  type ReferralDashboard,
  type ReferredPerson,
} from './dashboard';
