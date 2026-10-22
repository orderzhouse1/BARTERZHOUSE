import type { CookieOptions, Response } from 'express';

import { getEnv } from '../config/index.js';

function baseCookieOptions(): Pick<CookieOptions, 'secure' | 'sameSite' | 'domain' | 'path'> {
  const env = getEnv();

  return {
    secure: env.COOKIE_SECURE,
    sameSite: env.COOKIE_SAME_SITE,
    domain: env.COOKIE_DOMAIN,
    path: '/',
  };
}

export function setAccessCookie(res: Response, token: string): void {
  const env = getEnv();

  res.cookie(env.COOKIE_ACCESS_NAME, token, {
    ...baseCookieOptions(),
    httpOnly: true,
    maxAge: env.JWT_ACCESS_TTL_MINUTES * 60_000,
  });
}

export function setRefreshCookie(res: Response, token: string): void {
  const env = getEnv();

  res.cookie(env.COOKIE_REFRESH_NAME, token, {
    ...baseCookieOptions(),
    httpOnly: true,
    maxAge: env.JWT_REFRESH_TTL_DAYS * 86_400_000,
  });
}

export function setCsrfCookie(res: Response, token: string): void {
  const env = getEnv();

  res.cookie(env.COOKIE_CSRF_NAME, token, {
    ...baseCookieOptions(),
    // Must be readable by client-side JS for the double-submit CSRF pattern.
    httpOnly: false,
    maxAge: env.JWT_REFRESH_TTL_DAYS * 86_400_000,
  });
}

export function clearAuthCookies(res: Response): void {
  const env = getEnv();
  const options = { ...baseCookieOptions(), httpOnly: true };

  res.clearCookie(env.COOKIE_ACCESS_NAME, options);
  res.clearCookie(env.COOKIE_REFRESH_NAME, options);
}

export function clearCsrfCookie(res: Response): void {
  const env = getEnv();

  res.clearCookie(env.COOKIE_CSRF_NAME, { ...baseCookieOptions(), httpOnly: false });
}
