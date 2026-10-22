import type { Request, Response } from 'express';

import {
  forgotPasswordRequestSchema,
  loginRequestSchema,
  registerRequestSchema,
  resendVerificationRequestSchema,
  resetPasswordRequestSchema,
  verifyEmailRequestSchema,
} from '@barterzhouse/shared';

import { getEnv } from '../../config/index.js';
import { AppError } from '../../errors/app-error.js';
import { ErrorCodes } from '../../errors/codes.js';
import {
  clearAuthCookies,
  setAccessCookie,
  setCsrfCookie,
  setRefreshCookie,
} from '../../security/cookies.js';
import { createCsrfToken } from '../../security/csrf.js';
import { sha256Hex } from '../../security/tokens.js';
import type { AuthService } from './auth.service.js';

function getClientContext(req: Request): { ipHash: string | null; userAgent: string | null } {
  return {
    ipHash: req.ip ? sha256Hex(req.ip) : null,
    userAgent: req.header('user-agent') ?? null,
  };
}

export function createAuthController(service: AuthService) {
  return {
    csrf(_req: Request, res: Response): void {
      const token = createCsrfToken();
      setCsrfCookie(res, token);
      res.status(200).json({ data: { csrfToken: token } });
    },

    async register(req: Request, res: Response): Promise<void> {
      const body = registerRequestSchema.parse(req.body);
      const result = await service.register(body, getClientContext(req));
      setAccessCookie(res, result.tokens.accessToken);
      setRefreshCookie(res, result.tokens.refreshToken);
      res.status(201).json({ data: result.user });
    },

    async login(req: Request, res: Response): Promise<void> {
      const body = loginRequestSchema.parse(req.body);
      const result = await service.login(body, getClientContext(req));
      setAccessCookie(res, result.tokens.accessToken);
      setRefreshCookie(res, result.tokens.refreshToken);
      res.status(200).json({ data: result.user });
    },

    async refresh(req: Request, res: Response): Promise<void> {
      const env = getEnv();
      const token: unknown = req.cookies?.[env.COOKIE_REFRESH_NAME];

      if (typeof token !== 'string' || token.length === 0) {
        clearAuthCookies(res);
        throw new AppError({
          code: ErrorCodes.INVALID_REFRESH_TOKEN,
          message: 'Refresh token missing.',
          statusCode: 401,
        });
      }

      try {
        const result = await service.refresh(token, getClientContext(req));
        setAccessCookie(res, result.tokens.accessToken);
        setRefreshCookie(res, result.tokens.refreshToken);
        res.status(200).json({ data: result.user });
      } catch (error) {
        clearAuthCookies(res);
        throw error;
      }
    },

    async logout(req: Request, res: Response): Promise<void> {
      if (req.user) {
        await service.logout(req.user.sessionId);
      }
      clearAuthCookies(res);
      res.status(204).send();
    },

    async logoutAll(req: Request, res: Response): Promise<void> {
      if (req.user) {
        await service.logoutAll(req.user.userId);
      }
      clearAuthCookies(res);
      res.status(204).send();
    },

    async verifyEmail(req: Request, res: Response): Promise<void> {
      const body = verifyEmailRequestSchema.parse(req.body);
      const user = await service.verifyEmail(body.token);
      res.status(200).json({ data: user });
    },

    async resendVerification(req: Request, res: Response): Promise<void> {
      const body = resendVerificationRequestSchema.parse(req.body);
      await service.resendVerification(body.email, getClientContext(req));
      res.status(200).json({ data: { sent: true } });
    },

    async forgotPassword(req: Request, res: Response): Promise<void> {
      const body = forgotPasswordRequestSchema.parse(req.body);
      await service.forgotPassword(body.email, getClientContext(req));
      res.status(200).json({ data: { sent: true } });
    },

    async resetPassword(req: Request, res: Response): Promise<void> {
      const body = resetPasswordRequestSchema.parse(req.body);
      await service.resetPassword(body.token, body.password);
      res.status(200).json({ data: { reset: true } });
    },

    async me(req: Request, res: Response): Promise<void> {
      if (!req.user) {
        throw new AppError({
          code: ErrorCodes.AUTH_REQUIRED,
          message: 'Authentication required.',
          statusCode: 401,
        });
      }
      const user = await service.getMe(req.user.userId);
      res.status(200).json({ data: user });
    },
  };
}
