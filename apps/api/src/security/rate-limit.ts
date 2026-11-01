import { createHmac } from 'node:crypto';

import type { Request, RequestHandler } from 'express';
import rateLimit from 'express-rate-limit';

import { emailSchema } from '@barterzhouse/shared';

import { getEnv } from '../config/index.js';
import { AppError } from '../errors/app-error.js';
import { ErrorCodes } from '../errors/codes.js';
import { logger } from '../lib/logger.js';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

export const AUTH_RATE_LIMITS = {
  register: { windowMs: HOUR, limit: 10 },
  login: { windowMs: 15 * MINUTE, limit: 10 },
  refresh: { windowMs: 15 * MINUTE, limit: 60 },
  forgotPassword: { windowMs: HOUR, limit: 20 },
  resendVerification: { windowMs: HOUR, limit: 20 },
  email: { windowMs: HOUR, limit: 5 },
  resetPassword: { windowMs: 15 * MINUTE, limit: 10 },
  verifyEmail: { windowMs: 15 * MINUTE, limit: 30 },
} as const;

function normalizedEmail(req: Request): string | null {
  const parsed = emailSchema.safeParse(req.body?.email);
  return parsed.success ? parsed.data.toLowerCase() : null;
}

function createLimiter(
  policy: { windowMs: number; limit: number },
  scope: 'ip' | 'email' = 'ip',
): RequestHandler {
  // Each app/router owns its counters. MemoryStore protects one process only.
  // Tests use these same active limiters, never a NODE_ENV bypass.
  const limiter = rateLimit({
    ...policy,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    passOnStoreError: false,
    // The app deliberately ignores forwarded headers with trust proxy=false.
    validate: { xForwardedForHeader: false, forwardedHeader: false },
    ...(scope === 'email'
      ? {
          skip: (req: Request) => normalizedEmail(req) === null,
          keyGenerator: (req: Request) =>
            createHmac('sha256', getEnv().CSRF_SECRET)
              .update('auth-email-rate-limit:')
              .update(normalizedEmail(req) ?? '')
              .digest('hex'),
        }
      : {}),
    handler: (req, res) => {
      res.status(429).json({
        error: {
          code: ErrorCodes.RATE_LIMITED,
          message: 'Too many requests. Please try again later.',
          requestId: req.requestId,
        },
      });
    },
  });

  return (req, res, next) => {
    void limiter(req, res, (error?: unknown) => {
      if (error) {
        logger.error({ event: 'AUTH_RATE_LIMIT_FAILED' }, 'Authentication rate limiter failed.');
        next(
          new AppError({
            code: ErrorCodes.INTERNAL_ERROR,
            message: 'Authentication is temporarily unavailable.',
            statusCode: 503,
          }),
        );
        return;
      }
      next();
    });
  };
}

export function registerRateLimiter(): RequestHandler {
  return createLimiter(AUTH_RATE_LIMITS.register);
}

export function loginRateLimiter(): RequestHandler {
  return createLimiter(AUTH_RATE_LIMITS.login);
}

export function refreshRateLimiter(): RequestHandler {
  return createLimiter(AUTH_RATE_LIMITS.refresh);
}

export function forgotPasswordRateLimiter(): RequestHandler {
  return createLimiter(AUTH_RATE_LIMITS.forgotPassword);
}

export function resendVerificationRateLimiter(): RequestHandler {
  return createLimiter(AUTH_RATE_LIMITS.resendVerification);
}

export function forgotPasswordEmailRateLimiter(): RequestHandler {
  return createLimiter(AUTH_RATE_LIMITS.email, 'email');
}

export function resendVerificationEmailRateLimiter(): RequestHandler {
  return createLimiter(AUTH_RATE_LIMITS.email, 'email');
}

export function resetPasswordRateLimiter(): RequestHandler {
  return createLimiter(AUTH_RATE_LIMITS.resetPassword);
}

export function verifyEmailRateLimiter(): RequestHandler {
  return createLimiter(AUTH_RATE_LIMITS.verifyEmail);
}
