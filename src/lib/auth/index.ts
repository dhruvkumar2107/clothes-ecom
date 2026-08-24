export {
  parsePermissions,
  serializePermissions,
  hasPermission,
  hasAllPermissions,
  hasAnyPermission,
  expandPermissions,
  sanitizePermissions,
  SYSTEM_ROLES,
} from './permissions';

export {
  hashPassword,
  verifyPassword,
  needsRehash,
  scorePassword,
  assertPasswordAcceptable,
  type PasswordStrength,
} from './password';

export {
  signSessionToken,
  verifySessionToken,
  signChallengeToken,
  verifyChallengeToken,
  resetAuthKey,
  type Audience,
  type SessionClaims,
  type ChallengeClaims,
} from './jwt';

export {
  requestContext,
  createCustomerSession,
  loginCustomer,
  getCustomerSession,
  requireCustomer,
  logoutCustomer,
  revokeAllCustomerSessions,
  loginStaff,
  getStaffSession,
  logoutStaff,
  AuthRequiredError,
  ForbiddenError,
  COOKIE_NAMES,
  type RequestContext,
  type CustomerSession,
  type StaffSessionInfo,
} from './session';

export {
  issueOtp,
  verifyOtp,
  normalizeDestination,
  assertValidDestination,
  pruneExpiredOtps,
  OtpError,
  type IssueOtpInput,
  type IssuedOtp,
  type VerifiedOtp,
} from './otp';

export {
  requireStaff,
  requirePermission,
  requireAnyPermission,
  requirePermissionAndAudit,
  can,
  audit,
  auditAs,
  type ActorType,
  type AuditInput,
} from './guard';

export {
  googleEnabled,
  appleEnabled,
  enabledSocialProviders,
  googleAuthUrl,
  exchangeGoogleCode,
  appleAuthUrl,
  exchangeAppleCode,
  encodeState,
  decodeState,
  newNonce,
  redirectUri,
  OAuthError,
  type OAuthState,
  type SocialProfile,
} from './oauth';

export {
  signup,
  loginWithPassword,
  startOtpLogin,
  completeOtpLogin,
  loginWithSocial,
  unlinkSocial,
  requestPasswordReset,
  requestPasswordResetOtp,
  resetPasswordWithToken,
  resetPasswordWithOtp,
  changePassword,
  updateProfile,
  startIdentifierChange,
  completeIdentifierChange,
  normalizeEmail,
  fingerprint,
  pruneExpiredResets,
  AccountError,
  type SignupInput,
  type SignupResult,
  type LoginResult,
  type OtpLoginResult,
  type SocialLoginResult,
  type ProfileUpdate,
} from './accounts';
