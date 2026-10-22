export type UserRole = 'USER' | 'SUPER_ADMIN';
export type AccountStatus = 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED';
export type PreferredLocale = 'ar' | 'en';

export type AuthAuditEvent =
  | 'REGISTERED'
  | 'LOGIN_SUCCESS'
  | 'LOGIN_FAILURE'
  | 'PASSWORD_RESET'
  | 'SESSION_REVOKED'
  | 'ACCOUNT_DEACTIVATED'
  | 'EMAIL_VERIFIED'
  | 'REFRESH_REUSE_DETECTED';

export interface AuthContext {
  userId: string;
  sessionId: string;
  role: UserRole;
}

export interface UserRecord {
  id: string;
  email: string;
  normalizedEmail: string;
  passwordHash: string;
  role: UserRole;
  status: AccountStatus;
  emailVerifiedAt: Date | null;
  lastLoginAt: Date | null;
  deactivatedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProfileRecord {
  id: string;
  userId: string;
  displayName: string;
  bio: string | null;
  city: string | null;
  area: string | null;
  preferredLocale: PreferredLocale;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserWithProfile extends UserRecord {
  profile: ProfileRecord;
}

export interface SessionRecord {
  id: string;
  userId: string;
  familyId: string;
  refreshTokenHash: string;
  expiresAt: Date;
  lastUsedAt: Date;
  revokedAt: Date | null;
  revokeReason: string | null;
  userAgent: string | null;
  ipHash: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface EmailVerificationTokenRecord {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  usedAt: Date | null;
  createdAt: Date;
}

export interface PasswordResetTokenRecord {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  usedAt: Date | null;
  createdAt: Date;
}

export type ConsumeTokenStatus = 'ok' | 'not_found' | 'used' | 'expired';

export interface ConsumeTokenResult<T> {
  status: ConsumeTokenStatus;
  record?: T;
}

export interface CreateUserInput {
  email: string;
  normalizedEmail: string;
  passwordHash: string;
  displayName: string;
  preferredLocale: PreferredLocale;
}

export interface ProfilePatch {
  displayName?: string;
  bio?: string | null;
  city?: string | null;
  area?: string | null;
  preferredLocale?: PreferredLocale;
}

export interface CreateSessionInput {
  id: string;
  userId: string;
  familyId: string;
  refreshTokenHash: string;
  expiresAt: Date;
  userAgent?: string | null;
  ipHash?: string | null;
}

export interface CompareAndRotateSessionParams {
  sessionId: string;
  expectedHash: string;
  newHash: string;
  newExpiresAt: Date;
  lastUsedAt: Date;
}

export interface AuditLogInput {
  userId: string | null;
  event: AuthAuditEvent;
  metadata?: Record<string, unknown>;
  ipHash?: string | null;
  userAgent?: string | null;
}

export class DuplicateEmailError extends Error {
  constructor() {
    super('DUPLICATE_EMAIL');
    this.name = 'DuplicateEmailError';
  }
}

export interface AuthStore {
  createUserWithProfile(input: CreateUserInput): Promise<UserWithProfile>;
  findUserByNormalizedEmail(normalizedEmail: string): Promise<UserWithProfile | null>;
  findUserById(id: string): Promise<UserWithProfile | null>;
  updatePasswordHash(userId: string, passwordHash: string): Promise<void>;
  setEmailVerified(userId: string, verifiedAt: Date): Promise<void>;
  setLastLogin(userId: string, at: Date): Promise<void>;
  updateProfile(userId: string, patch: ProfilePatch): Promise<UserWithProfile>;
  deactivateUser(userId: string, at: Date): Promise<void>;
  setUserStatus(userId: string, status: AccountStatus, at: Date): Promise<void>;

  createSession(input: CreateSessionInput): Promise<SessionRecord>;
  findSessionById(id: string): Promise<SessionRecord | null>;
  compareAndRotateSession(params: CompareAndRotateSessionParams): Promise<SessionRecord | null>;
  revokeSession(id: string, reason: string, at: Date): Promise<void>;
  revokeFamily(familyId: string, reason: string, at: Date): Promise<void>;
  revokeAllUserSessions(userId: string, reason: string, at: Date): Promise<void>;

  createEmailVerificationToken(input: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<EmailVerificationTokenRecord>;
  consumeEmailVerificationToken(
    tokenHash: string,
    now: Date,
  ): Promise<ConsumeTokenResult<EmailVerificationTokenRecord>>;

  createPasswordResetToken(input: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<PasswordResetTokenRecord>;
  consumePasswordResetToken(
    tokenHash: string,
    now: Date,
  ): Promise<ConsumeTokenResult<PasswordResetTokenRecord>>;

  writeAuditLog(entry: AuditLogInput): Promise<void>;
}
