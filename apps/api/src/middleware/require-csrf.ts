import type { NextFunction, Request, Response } from 'express';

import { getEnv } from '../config/index.js';
import { AppError } from '../errors/app-error.js';
import { ErrorCodes } from '../errors/codes.js';
import { isValidCsrfToken } from '../security/csrf.js';
import { timingSafeStringEqual } from '../security/tokens.js';

export function requireCsrf(req: Request, _res: Response, next: NextFunction): void {
  const env = getEnv();
  const cookieToken: unknown = req.cookies?.[env.COOKIE_CSRF_NAME];
  const headerToken = req.header('x-csrf-token');

  const csrfError = new AppError({
    code: ErrorCodes.CSRF_INVALID,
    message: 'CSRF validation failed.',
    statusCode: 403,
  });

  if (typeof cookieToken !== 'string' || cookieToken.length === 0 || !headerToken) {
    next(csrfError);
    return;
  }

  if (!isValidCsrfToken(cookieToken) || !timingSafeStringEqual(cookieToken, headerToken)) {
    next(csrfError);
    return;
  }

  req.csrfValidated = true;
  next();
}
