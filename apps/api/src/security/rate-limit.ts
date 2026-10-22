import type { RequestHandler } from 'express';
import rateLimit from 'express-rate-limit';

import { getEnv } from '../config/index.js';

function passthrough(
  _req: Parameters<RequestHandler>[0],
  _res: Parameters<RequestHandler>[1],
  next: Parameters<RequestHandler>[2],
): void {
  next();
}

function createLimiter(windowMs: number, max: number): RequestHandler {
  const env = getEnv();

  // Rate limiting is disabled in tests so the suite can exercise flows repeatedly
  // without tripping limits designed for production traffic.
  if (env.NODE_ENV === 'test') {
    return passthrough;
  }

  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
  });
}

export function registerRateLimiter(): RequestHandler {
  return createLimiter(60 * 60 * 1000, 10);
}

export function loginRateLimiter(): RequestHandler {
  return createLimiter(15 * 60 * 1000, 10);
}

export function refreshRateLimiter(): RequestHandler {
  return createLimiter(15 * 60 * 1000, 60);
}

export function forgotPasswordRateLimiter(): RequestHandler {
  return createLimiter(60 * 60 * 1000, 5);
}

export function resendVerificationRateLimiter(): RequestHandler {
  return createLimiter(60 * 60 * 1000, 5);
}
