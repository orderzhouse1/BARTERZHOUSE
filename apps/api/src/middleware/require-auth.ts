import type { NextFunction, Request, Response } from 'express';
import { errors as joseErrors } from 'jose';

import { getEnv } from '../config/index.js';
import { AppError } from '../errors/app-error.js';
import { ErrorCodes } from '../errors/codes.js';
import type { AuthStore } from '../modules/auth/auth.types.js';
import { verifyAccessToken } from '../security/jwt.js';

export function createRequireAuth(store: AuthStore) {
  return async function requireAuth(
    req: Request,
    _res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const env = getEnv();
      const token: unknown = req.cookies?.[env.COOKIE_ACCESS_NAME];

      if (typeof token !== 'string' || token.length === 0) {
        throw new AppError({
          code: ErrorCodes.AUTH_REQUIRED,
          message: 'Authentication required.',
          statusCode: 401,
        });
      }

      let payload;
      try {
        payload = await verifyAccessToken(token);
      } catch (error) {
        if (error instanceof joseErrors.JWTExpired) {
          throw new AppError({
            code: ErrorCodes.ACCESS_TOKEN_EXPIRED,
            message: 'Access token expired.',
            statusCode: 401,
          });
        }
        throw new AppError({
          code: ErrorCodes.AUTH_REQUIRED,
          message: 'Invalid access token.',
          statusCode: 401,
        });
      }

      const user = await store.findUserById(payload.sub);

      if (!user) {
        throw new AppError({
          code: ErrorCodes.AUTH_REQUIRED,
          message: 'Authentication required.',
          statusCode: 401,
        });
      }

      if (user.status === 'SUSPENDED') {
        throw new AppError({
          code: ErrorCodes.ACCOUNT_SUSPENDED,
          message: 'Account suspended.',
          statusCode: 403,
        });
      }

      if (user.status === 'DEACTIVATED') {
        throw new AppError({
          code: ErrorCodes.ACCOUNT_DEACTIVATED,
          message: 'Account deactivated.',
          statusCode: 403,
        });
      }

      req.user = { userId: user.id, sessionId: payload.sid, role: user.role };
      next();
    } catch (error) {
      next(error);
    }
  };
}
