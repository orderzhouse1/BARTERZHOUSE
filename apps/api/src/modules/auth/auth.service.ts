import { randomUUID } from 'node:crypto';

import type { LoginRequest, PublicAuthenticatedUser, RegisterRequest } from '@barterzhouse/shared';

import { getEnv } from '../../config/index.js';
import { AppError } from '../../errors/app-error.js';
import { ErrorCodes } from '../../errors/codes.js';
import type { EmailDelivery } from '../../security/email/types.js';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../../security/jwt.js';
import { hashPassword, verifyPassword } from '../../security/password.js';
import { serializeUser } from '../../security/serialize-user.js';
import { generateOpaqueToken, sha256Hex } from '../../security/tokens.js';
import type { AuthStore, UserWithProfile } from './auth.types.js';
import { DuplicateEmailError } from './auth.types.js';

const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;
const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function invalidCredentialsError(): AppError {
  return new AppError({
    code: ErrorCodes.INVALID_CREDENTIALS,
    message: 'Invalid email or password.',
    statusCode: 401,
  });
}

function inactiveAccountError(status: 'SUSPENDED' | 'DEACTIVATED'): AppError {
  return status === 'SUSPENDED'
    ? new AppError({
        code: ErrorCodes.ACCOUNT_SUSPENDED,
        message: 'This account has been suspended.',
        statusCode: 403,
      })
    : new AppError({
        code: ErrorCodes.ACCOUNT_DEACTIVATED,
        message: 'This account has been deactivated.',
        statusCode: 403,
      });
}

export interface RequestContext {
  ipHash?: string | null;
  userAgent?: string | null;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: Date;
  refreshTokenExpiresAt: Date;
}

export interface AuthResult {
  user: PublicAuthenticatedUser;
  tokens: AuthTokens;
}

export class AuthService {
  constructor(
    private readonly store: AuthStore,
    private readonly emailDelivery: EmailDelivery,
  ) {}

  async register(input: RegisterRequest, ctx: RequestContext = {}): Promise<AuthResult> {
    const normalizedEmail = normalizeEmail(input.email);
    const existing = await this.store.findUserByNormalizedEmail(normalizedEmail);

    if (existing) {
      throw new AppError({
        code: ErrorCodes.EMAIL_ALREADY_REGISTERED,
        message: 'This email is already registered.',
        statusCode: 409,
      });
    }

    const passwordHash = await hashPassword(input.password);

    let user: UserWithProfile;
    try {
      user = await this.store.createUserWithProfile({
        email: input.email.trim(),
        normalizedEmail,
        passwordHash,
        displayName: input.displayName,
        preferredLocale: input.preferredLocale,
      });
    } catch (error) {
      if (error instanceof DuplicateEmailError) {
        throw new AppError({
          code: ErrorCodes.EMAIL_ALREADY_REGISTERED,
          message: 'This email is already registered.',
          statusCode: 409,
        });
      }
      throw error;
    }

    await this.store.writeAuditLog({
      userId: user.id,
      event: 'REGISTERED',
      ipHash: ctx.ipHash ?? null,
      userAgent: ctx.userAgent ?? null,
    });

    await this.issueEmailVerification(user);

    const tokens = await this.issueSession(user, ctx);

    return { user: serializeUser(user), tokens };
  }

  async login(input: LoginRequest, ctx: RequestContext = {}): Promise<AuthResult> {
    const normalizedEmail = normalizeEmail(input.email);
    const user = await this.store.findUserByNormalizedEmail(normalizedEmail);

    if (!user) {
      throw invalidCredentialsError();
    }

    const passwordValid = await verifyPassword(user.passwordHash, input.password);

    if (!passwordValid) {
      await this.store.writeAuditLog({
        userId: user.id,
        event: 'LOGIN_FAILURE',
        metadata: { reason: 'invalid_password' },
        ipHash: ctx.ipHash ?? null,
        userAgent: ctx.userAgent ?? null,
      });
      throw invalidCredentialsError();
    }

    if (user.status === 'SUSPENDED' || user.status === 'DEACTIVATED') {
      await this.store.writeAuditLog({
        userId: user.id,
        event: 'LOGIN_FAILURE',
        metadata: { reason: user.status.toLowerCase() },
        ipHash: ctx.ipHash ?? null,
        userAgent: ctx.userAgent ?? null,
      });
      throw inactiveAccountError(user.status);
    }

    const now = new Date();
    await this.store.setLastLogin(user.id, now);
    await this.store.writeAuditLog({
      userId: user.id,
      event: 'LOGIN_SUCCESS',
      ipHash: ctx.ipHash ?? null,
      userAgent: ctx.userAgent ?? null,
    });

    const tokens = await this.issueSession(user, ctx);

    return { user: serializeUser({ ...user, lastLoginAt: now }), tokens };
  }

  async refresh(refreshTokenValue: string, ctx: RequestContext = {}): Promise<AuthResult> {
    let payload;
    try {
      payload = await verifyRefreshToken(refreshTokenValue);
    } catch {
      throw new AppError({
        code: ErrorCodes.INVALID_REFRESH_TOKEN,
        message: 'Invalid refresh token.',
        statusCode: 401,
      });
    }

    const session = await this.store.findSessionById(payload.sid);
    const now = new Date();

    if (!session || session.revokedAt || session.expiresAt.getTime() < now.getTime()) {
      throw new AppError({
        code: ErrorCodes.INVALID_REFRESH_TOKEN,
        message: 'Invalid refresh token.',
        statusCode: 401,
      });
    }

    const presentedHash = sha256Hex(refreshTokenValue);
    const newRefresh = await signRefreshToken({
      userId: payload.sub,
      sessionId: session.id,
      role: payload.role,
    });
    const newHash = sha256Hex(newRefresh.token);

    const rotated = await this.store.compareAndRotateSession({
      sessionId: session.id,
      expectedHash: presentedHash,
      newHash,
      newExpiresAt: newRefresh.expiresAt,
      lastUsedAt: now,
    });

    if (!rotated) {
      await this.store.revokeFamily(session.familyId, 'REFRESH_REUSE_DETECTED', now);
      await this.store.writeAuditLog({
        userId: session.userId,
        event: 'REFRESH_REUSE_DETECTED',
        ipHash: ctx.ipHash ?? null,
        userAgent: ctx.userAgent ?? null,
      });
      throw new AppError({
        code: ErrorCodes.INVALID_REFRESH_TOKEN,
        message: 'Refresh token reuse detected. All sessions in this family were revoked.',
        statusCode: 401,
      });
    }

    const user = await this.store.findUserById(payload.sub);

    if (!user) {
      throw new AppError({
        code: ErrorCodes.INVALID_REFRESH_TOKEN,
        message: 'Invalid refresh token.',
        statusCode: 401,
      });
    }

    if (user.status === 'SUSPENDED' || user.status === 'DEACTIVATED') {
      await this.store.revokeSession(session.id, `ACCOUNT_${user.status}`, now);
      throw inactiveAccountError(user.status);
    }

    const access = await signAccessToken({
      userId: user.id,
      sessionId: session.id,
      role: user.role,
    });

    return {
      user: serializeUser(user),
      tokens: {
        accessToken: access.token,
        refreshToken: newRefresh.token,
        accessTokenExpiresAt: access.expiresAt,
        refreshTokenExpiresAt: newRefresh.expiresAt,
      },
    };
  }

  async logout(sessionId: string): Promise<void> {
    const now = new Date();
    const session = await this.store.findSessionById(sessionId);
    await this.store.revokeSession(sessionId, 'LOGOUT', now);
    await this.store.writeAuditLog({
      userId: session?.userId ?? null,
      event: 'SESSION_REVOKED',
      metadata: { reason: 'logout' },
    });
  }

  async logoutAll(userId: string): Promise<void> {
    const now = new Date();
    await this.store.revokeAllUserSessions(userId, 'LOGOUT_ALL', now);
    await this.store.writeAuditLog({
      userId,
      event: 'SESSION_REVOKED',
      metadata: { reason: 'logout_all' },
    });
  }

  async verifyEmail(token: string): Promise<PublicAuthenticatedUser> {
    const tokenHash = sha256Hex(token);
    const now = new Date();
    const result = await this.store.consumeEmailVerificationToken(tokenHash, now);

    if (result.status === 'expired') {
      throw new AppError({
        code: ErrorCodes.VERIFICATION_TOKEN_EXPIRED,
        message: 'Verification link has expired.',
        statusCode: 400,
      });
    }

    if (result.status !== 'ok' || !result.record) {
      throw new AppError({
        code: ErrorCodes.VERIFICATION_TOKEN_INVALID,
        message: 'Verification link is invalid.',
        statusCode: 400,
      });
    }

    await this.store.setEmailVerified(result.record.userId, now);
    await this.store.writeAuditLog({ userId: result.record.userId, event: 'EMAIL_VERIFIED' });

    const user = await this.store.findUserById(result.record.userId);
    if (!user) {
      throw new AppError({
        code: ErrorCodes.NOT_FOUND,
        message: 'User not found.',
        statusCode: 404,
      });
    }

    return serializeUser(user);
  }

  async resendVerification(email: string, _ctx: RequestContext = {}): Promise<void> {
    const normalizedEmail = normalizeEmail(email);
    const user = await this.store.findUserByNormalizedEmail(normalizedEmail);

    // Generic behavior regardless of whether the account exists / is already
    // verified, to avoid leaking account existence via response timing/shape.
    if (user && !user.emailVerifiedAt) {
      await this.issueEmailVerification(user);
    }
  }

  async forgotPassword(email: string, _ctx: RequestContext = {}): Promise<void> {
    const normalizedEmail = normalizeEmail(email);
    const user = await this.store.findUserByNormalizedEmail(normalizedEmail);

    if (!user) {
      return;
    }

    const token = generateOpaqueToken();
    const tokenHash = sha256Hex(token);
    const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MS);

    await this.store.createPasswordResetToken({ userId: user.id, tokenHash, expiresAt });

    const env = getEnv();
    const url = `${env.PASSWORD_RESET_URL}?token=${encodeURIComponent(token)}`;
    await this.emailDelivery.sendPasswordResetEmail(user.email, url);
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const tokenHash = sha256Hex(token);
    const now = new Date();
    const result = await this.store.consumePasswordResetToken(tokenHash, now);

    if (result.status === 'expired') {
      throw new AppError({
        code: ErrorCodes.RESET_TOKEN_EXPIRED,
        message: 'Reset link has expired.',
        statusCode: 400,
      });
    }

    if (result.status !== 'ok' || !result.record) {
      throw new AppError({
        code: ErrorCodes.RESET_TOKEN_INVALID,
        message: 'Reset link is invalid.',
        statusCode: 400,
      });
    }

    const passwordHash = await hashPassword(newPassword);
    await this.store.updatePasswordHash(result.record.userId, passwordHash);
    await this.store.revokeAllUserSessions(result.record.userId, 'PASSWORD_RESET', now);
    await this.store.writeAuditLog({ userId: result.record.userId, event: 'PASSWORD_RESET' });
  }

  async getMe(userId: string): Promise<PublicAuthenticatedUser> {
    const user = await this.store.findUserById(userId);

    if (!user) {
      throw new AppError({
        code: ErrorCodes.AUTH_REQUIRED,
        message: 'Authentication required.',
        statusCode: 401,
      });
    }

    return serializeUser(user);
  }

  private async issueEmailVerification(user: UserWithProfile): Promise<void> {
    const token = generateOpaqueToken();
    const tokenHash = sha256Hex(token);
    const expiresAt = new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS);

    await this.store.createEmailVerificationToken({ userId: user.id, tokenHash, expiresAt });

    const env = getEnv();
    const url = `${env.EMAIL_VERIFICATION_URL}?token=${encodeURIComponent(token)}`;
    await this.emailDelivery.sendVerificationEmail(user.email, url);
  }

  private async issueSession(user: UserWithProfile, ctx: RequestContext): Promise<AuthTokens> {
    const sessionId = randomUUID();
    const familyId = randomUUID();

    const refresh = await signRefreshToken({ userId: user.id, sessionId, role: user.role });
    const refreshTokenHash = sha256Hex(refresh.token);

    await this.store.createSession({
      id: sessionId,
      userId: user.id,
      familyId,
      refreshTokenHash,
      expiresAt: refresh.expiresAt,
      userAgent: ctx.userAgent ?? null,
      ipHash: ctx.ipHash ?? null,
    });

    const access = await signAccessToken({ userId: user.id, sessionId, role: user.role });

    return {
      accessToken: access.token,
      refreshToken: refresh.token,
      accessTokenExpiresAt: access.expiresAt,
      refreshTokenExpiresAt: refresh.expiresAt,
    };
  }
}
