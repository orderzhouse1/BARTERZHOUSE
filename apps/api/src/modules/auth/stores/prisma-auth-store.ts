import { Prisma, type PrismaClient } from '@prisma/client';

import { getPrismaClient } from '../../../lib/prisma.js';
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
  SessionRecord,
  UserWithProfile,
} from '../auth.types.js';
import { DuplicateEmailError } from '../auth.types.js';

/**
 * Prisma-backed implementation of AuthStore, used when AUTH_PERSISTENCE=prisma.
 * The Prisma client is only touched lazily (via getPrismaClient), so this module can
 * be imported safely even when no DATABASE_URL is configured.
 */
export class PrismaAuthStore implements AuthStore {
  private get client(): PrismaClient {
    return getPrismaClient();
  }

  async createUserWithProfile(input: CreateUserInput): Promise<UserWithProfile> {
    try {
      const user = await this.client.user.create({
        data: {
          email: input.email,
          normalizedEmail: input.normalizedEmail,
          passwordHash: input.passwordHash,
          profile: {
            create: {
              displayName: input.displayName,
              preferredLocale: input.preferredLocale,
            },
          },
        },
        include: { profile: true },
      });
      return user as UserWithProfile;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new DuplicateEmailError();
      }
      throw error;
    }
  }

  async findUserByNormalizedEmail(normalizedEmail: string): Promise<UserWithProfile | null> {
    const user = await this.client.user.findUnique({
      where: { normalizedEmail },
      include: { profile: true },
    });
    return user && user.profile ? (user as UserWithProfile) : null;
  }

  async findUserById(id: string): Promise<UserWithProfile | null> {
    const user = await this.client.user.findUnique({
      where: { id },
      include: { profile: true },
    });
    return user && user.profile ? (user as UserWithProfile) : null;
  }

  async updatePasswordHash(userId: string, passwordHash: string): Promise<void> {
    await this.client.user.update({ where: { id: userId }, data: { passwordHash } });
  }

  async setEmailVerified(userId: string, verifiedAt: Date): Promise<void> {
    await this.client.user.update({ where: { id: userId }, data: { emailVerifiedAt: verifiedAt } });
  }

  async setLastLogin(userId: string, at: Date): Promise<void> {
    await this.client.user.update({ where: { id: userId }, data: { lastLoginAt: at } });
  }

  async updateProfile(userId: string, patch: ProfilePatch): Promise<UserWithProfile> {
    const user = await this.client.user.update({
      where: { id: userId },
      data: {
        profile: {
          update: {
            ...(patch.displayName !== undefined ? { displayName: patch.displayName } : {}),
            ...(patch.bio !== undefined ? { bio: patch.bio } : {}),
            ...(patch.city !== undefined ? { city: patch.city } : {}),
            ...(patch.area !== undefined ? { area: patch.area } : {}),
            ...(patch.preferredLocale !== undefined
              ? { preferredLocale: patch.preferredLocale }
              : {}),
          },
        },
      },
      include: { profile: true },
    });
    return user as UserWithProfile;
  }

  async deactivateUser(userId: string, at: Date): Promise<void> {
    await this.client.user.update({
      where: { id: userId },
      data: { status: 'DEACTIVATED', deactivatedAt: at },
    });
  }

  async setUserStatus(
    userId: string,
    status: 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED',
    at: Date,
  ): Promise<void> {
    await this.client.user.update({
      where: { id: userId },
      data: {
        status,
        ...(status === 'DEACTIVATED' ? { deactivatedAt: at } : {}),
      },
    });
  }

  async createSession(input: CreateSessionInput): Promise<SessionRecord> {
    return this.client.authSession.create({
      data: {
        id: input.id,
        userId: input.userId,
        familyId: input.familyId,
        refreshTokenHash: input.refreshTokenHash,
        expiresAt: input.expiresAt,
        userAgent: input.userAgent ?? null,
        ipHash: input.ipHash ?? null,
      },
    });
  }

  async findSessionById(id: string): Promise<SessionRecord | null> {
    return this.client.authSession.findUnique({ where: { id } });
  }

  async compareAndRotateSession(
    params: CompareAndRotateSessionParams,
  ): Promise<SessionRecord | null> {
    const result = await this.client.authSession.updateMany({
      where: {
        id: params.sessionId,
        refreshTokenHash: params.expectedHash,
        revokedAt: null,
      },
      data: {
        refreshTokenHash: params.newHash,
        expiresAt: params.newExpiresAt,
        lastUsedAt: params.lastUsedAt,
      },
    });

    if (result.count === 0) {
      return null;
    }

    return this.client.authSession.findUnique({ where: { id: params.sessionId } });
  }

  async revokeSession(id: string, reason: string, at: Date): Promise<void> {
    await this.client.authSession.updateMany({
      where: { id, revokedAt: null },
      data: { revokedAt: at, revokeReason: reason },
    });
  }

  async revokeFamily(familyId: string, reason: string, at: Date): Promise<void> {
    await this.client.authSession.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: at, revokeReason: reason },
    });
  }

  async revokeAllUserSessions(userId: string, reason: string, at: Date): Promise<void> {
    await this.client.authSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: at, revokeReason: reason },
    });
  }

  async createEmailVerificationToken(input: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<EmailVerificationTokenRecord> {
    return this.client.emailVerificationToken.create({ data: input });
  }

  async consumeEmailVerificationToken(
    tokenHash: string,
    now: Date,
  ): Promise<ConsumeTokenResult<EmailVerificationTokenRecord>> {
    const record = await this.client.emailVerificationToken.findUnique({ where: { tokenHash } });
    if (!record) return { status: 'not_found' };
    if (record.usedAt) return { status: 'used' };
    if (record.expiresAt.getTime() < now.getTime()) return { status: 'expired' };

    const result = await this.client.emailVerificationToken.updateMany({
      where: { tokenHash, usedAt: null },
      data: { usedAt: now },
    });
    if (result.count === 0) return { status: 'used' };

    return { status: 'ok', record: { ...record, usedAt: now } };
  }

  async createPasswordResetToken(input: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<PasswordResetTokenRecord> {
    return this.client.passwordResetToken.create({ data: input });
  }

  async consumePasswordResetToken(
    tokenHash: string,
    now: Date,
  ): Promise<ConsumeTokenResult<PasswordResetTokenRecord>> {
    const record = await this.client.passwordResetToken.findUnique({ where: { tokenHash } });
    if (!record) return { status: 'not_found' };
    if (record.usedAt) return { status: 'used' };
    if (record.expiresAt.getTime() < now.getTime()) return { status: 'expired' };

    const result = await this.client.passwordResetToken.updateMany({
      where: { tokenHash, usedAt: null },
      data: { usedAt: now },
    });
    if (result.count === 0) return { status: 'used' };

    return { status: 'ok', record: { ...record, usedAt: now } };
  }

  async writeAuditLog(entry: AuditLogInput): Promise<void> {
    await this.client.authAuditLog.create({
      data: {
        userId: entry.userId,
        event: entry.event,
        metadata: entry.metadata as Prisma.InputJsonValue | undefined,
        ipHash: entry.ipHash ?? null,
        userAgent: entry.userAgent ?? null,
      },
    });
  }
}

let instance: PrismaAuthStore | undefined;

export function getPrismaAuthStore(): AuthStore {
  instance ??= new PrismaAuthStore();
  return instance;
}
