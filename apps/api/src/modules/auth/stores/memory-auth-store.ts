import { randomUUID } from 'node:crypto';

import { KeyedMutex } from '../../../lib/mutex.js';
import type {
  AuditLogInput,
  AuthStore,
  CompareAndRotateSessionParams,
  ConsumeTokenResult,
  CreateSessionInput,
  CreateUserInput,
  EmailVerificationTokenRecord,
  PasswordResetTokenRecord,
  ProfilePatch,
  ProfileRecord,
  SessionRecord,
  UserRecord,
  UserWithProfile,
} from '../auth.types.js';
import { DuplicateEmailError } from '../auth.types.js';

/**
 * Fully in-memory implementation of AuthStore. Used by the test suite and by local
 * development runs that have no DATABASE_URL configured (AUTH_PERSISTENCE=memory).
 * Data does not persist across process restarts.
 */
export class MemoryAuthStore implements AuthStore {
  private readonly users = new Map<string, UserRecord>();
  private readonly userIdByNormalizedEmail = new Map<string, string>();
  private readonly profiles = new Map<string, ProfileRecord>();
  private readonly sessions = new Map<string, SessionRecord>();
  private readonly emailVerificationTokens = new Map<string, EmailVerificationTokenRecord>();
  private readonly passwordResetTokens = new Map<string, PasswordResetTokenRecord>();
  private readonly mutex = new KeyedMutex();

  readonly auditLogs: Array<AuditLogInput & { id: string; createdAt: Date }> = [];

  /** Test/debug helper — not part of the AuthStore contract. */
  listSessions(): SessionRecord[] {
    return [...this.sessions.values()];
  }

  private toUserWithProfile(user: UserRecord): UserWithProfile {
    const profile = this.profiles.get(user.id);
    if (!profile) {
      throw new Error(`Profile missing for user ${user.id}`);
    }
    return { ...user, profile };
  }

  async createUserWithProfile(input: CreateUserInput): Promise<UserWithProfile> {
    if (this.userIdByNormalizedEmail.has(input.normalizedEmail)) {
      throw new DuplicateEmailError();
    }

    const now = new Date();
    const id = randomUUID();

    const user: UserRecord = {
      id,
      email: input.email,
      normalizedEmail: input.normalizedEmail,
      passwordHash: input.passwordHash,
      role: 'USER',
      status: 'ACTIVE',
      emailVerifiedAt: null,
      lastLoginAt: null,
      deactivatedAt: null,
      createdAt: now,
      updatedAt: now,
    };

    const profile: ProfileRecord = {
      id: randomUUID(),
      userId: id,
      displayName: input.displayName,
      bio: null,
      city: null,
      area: null,
      preferredLocale: input.preferredLocale,
      createdAt: now,
      updatedAt: now,
    };

    this.users.set(id, user);
    this.userIdByNormalizedEmail.set(input.normalizedEmail, id);
    this.profiles.set(id, profile);

    return this.toUserWithProfile(user);
  }

  async findUserByNormalizedEmail(normalizedEmail: string): Promise<UserWithProfile | null> {
    const id = this.userIdByNormalizedEmail.get(normalizedEmail);
    if (!id) return null;
    const user = this.users.get(id);
    return user ? this.toUserWithProfile(user) : null;
  }

  async findUserById(id: string): Promise<UserWithProfile | null> {
    const user = this.users.get(id);
    return user ? this.toUserWithProfile(user) : null;
  }

  async updatePasswordHash(userId: string, passwordHash: string): Promise<void> {
    const user = this.users.get(userId);
    if (!user) return;
    user.passwordHash = passwordHash;
    user.updatedAt = new Date();
  }

  async setEmailVerified(userId: string, verifiedAt: Date): Promise<void> {
    const user = this.users.get(userId);
    if (!user) return;
    user.emailVerifiedAt = verifiedAt;
    user.updatedAt = new Date();
  }

  async setLastLogin(userId: string, at: Date): Promise<void> {
    const user = this.users.get(userId);
    if (!user) return;
    user.lastLoginAt = at;
    user.updatedAt = at;
  }

  async updateProfile(userId: string, patch: ProfilePatch): Promise<UserWithProfile> {
    const user = this.users.get(userId);
    const profile = this.profiles.get(userId);
    if (!user || !profile) {
      throw new Error('USER_NOT_FOUND');
    }

    const updated: ProfileRecord = {
      ...profile,
      ...(patch.displayName !== undefined ? { displayName: patch.displayName } : {}),
      ...(patch.bio !== undefined ? { bio: patch.bio } : {}),
      ...(patch.city !== undefined ? { city: patch.city } : {}),
      ...(patch.area !== undefined ? { area: patch.area } : {}),
      ...(patch.preferredLocale !== undefined ? { preferredLocale: patch.preferredLocale } : {}),
      updatedAt: new Date(),
    };

    this.profiles.set(userId, updated);

    return this.toUserWithProfile(user);
  }

  async deactivateUser(userId: string, at: Date): Promise<void> {
    const user = this.users.get(userId);
    if (!user) return;
    user.status = 'DEACTIVATED';
    user.deactivatedAt = at;
    user.updatedAt = at;
  }

  async setUserStatus(userId: string, status: UserRecord['status'], at: Date): Promise<void> {
    const user = this.users.get(userId);
    if (!user) return;
    user.status = status;
    user.updatedAt = at;
    if (status === 'DEACTIVATED') {
      user.deactivatedAt = at;
    }
  }

  async createSession(input: CreateSessionInput): Promise<SessionRecord> {
    const now = new Date();
    const session: SessionRecord = {
      id: input.id,
      userId: input.userId,
      familyId: input.familyId,
      refreshTokenHash: input.refreshTokenHash,
      expiresAt: input.expiresAt,
      lastUsedAt: now,
      revokedAt: null,
      revokeReason: null,
      userAgent: input.userAgent ?? null,
      ipHash: input.ipHash ?? null,
      createdAt: now,
      updatedAt: now,
    };

    this.sessions.set(session.id, session);
    return session;
  }

  async findSessionById(id: string): Promise<SessionRecord | null> {
    return this.sessions.get(id) ?? null;
  }

  async compareAndRotateSession(
    params: CompareAndRotateSessionParams,
  ): Promise<SessionRecord | null> {
    return this.mutex.run(`session:${params.sessionId}`, async () => {
      const session = this.sessions.get(params.sessionId);
      if (!session || session.revokedAt) {
        return null;
      }
      if (session.refreshTokenHash !== params.expectedHash) {
        return null;
      }

      const updated: SessionRecord = {
        ...session,
        refreshTokenHash: params.newHash,
        expiresAt: params.newExpiresAt,
        lastUsedAt: params.lastUsedAt,
        updatedAt: new Date(),
      };

      this.sessions.set(params.sessionId, updated);
      return updated;
    });
  }

  async revokeSession(id: string, reason: string, at: Date): Promise<void> {
    const session = this.sessions.get(id);
    if (!session) return;
    session.revokedAt = at;
    session.revokeReason = reason;
    session.updatedAt = at;
  }

  async revokeFamily(familyId: string, reason: string, at: Date): Promise<void> {
    for (const session of this.sessions.values()) {
      if (session.familyId === familyId && !session.revokedAt) {
        session.revokedAt = at;
        session.revokeReason = reason;
        session.updatedAt = at;
      }
    }
  }

  async revokeAllUserSessions(userId: string, reason: string, at: Date): Promise<void> {
    for (const session of this.sessions.values()) {
      if (session.userId === userId && !session.revokedAt) {
        session.revokedAt = at;
        session.revokeReason = reason;
        session.updatedAt = at;
      }
    }
  }

  async createEmailVerificationToken(input: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<EmailVerificationTokenRecord> {
    const record: EmailVerificationTokenRecord = {
      id: randomUUID(),
      userId: input.userId,
      tokenHash: input.tokenHash,
      expiresAt: input.expiresAt,
      usedAt: null,
      createdAt: new Date(),
    };
    this.emailVerificationTokens.set(input.tokenHash, record);
    return record;
  }

  async consumeEmailVerificationToken(
    tokenHash: string,
    now: Date,
  ): Promise<ConsumeTokenResult<EmailVerificationTokenRecord>> {
    return this.mutex.run(`evt:${tokenHash}`, async () => {
      const record = this.emailVerificationTokens.get(tokenHash);
      if (!record) return { status: 'not_found' };
      if (record.usedAt) return { status: 'used' };
      if (record.expiresAt.getTime() < now.getTime()) return { status: 'expired' };

      const updated: EmailVerificationTokenRecord = { ...record, usedAt: now };
      this.emailVerificationTokens.set(tokenHash, updated);
      return { status: 'ok', record: updated };
    });
  }

  async createPasswordResetToken(input: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<PasswordResetTokenRecord> {
    const record: PasswordResetTokenRecord = {
      id: randomUUID(),
      userId: input.userId,
      tokenHash: input.tokenHash,
      expiresAt: input.expiresAt,
      usedAt: null,
      createdAt: new Date(),
    };
    this.passwordResetTokens.set(input.tokenHash, record);
    return record;
  }

  async consumePasswordResetToken(
    tokenHash: string,
    now: Date,
  ): Promise<ConsumeTokenResult<PasswordResetTokenRecord>> {
    return this.mutex.run(`prt:${tokenHash}`, async () => {
      const record = this.passwordResetTokens.get(tokenHash);
      if (!record) return { status: 'not_found' };
      if (record.usedAt) return { status: 'used' };
      if (record.expiresAt.getTime() < now.getTime()) return { status: 'expired' };

      const updated: PasswordResetTokenRecord = { ...record, usedAt: now };
      this.passwordResetTokens.set(tokenHash, updated);
      return { status: 'ok', record: updated };
    });
  }

  async writeAuditLog(entry: AuditLogInput): Promise<void> {
    this.auditLogs.push({ ...entry, id: randomUUID(), createdAt: new Date() });
  }
}
