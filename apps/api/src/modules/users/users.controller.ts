import type { Request, Response } from 'express';

import { updateProfileRequestSchema } from '@barterzhouse/shared';

import { AppError } from '../../errors/app-error.js';
import { ErrorCodes } from '../../errors/codes.js';
import { clearAuthCookies } from '../../security/cookies.js';
import type { UsersService } from './users.service.js';

export function createUsersController(service: UsersService) {
  return {
    async updateProfile(req: Request, res: Response): Promise<void> {
      if (!req.user) {
        throw new AppError({
          code: ErrorCodes.AUTH_REQUIRED,
          message: 'Authentication required.',
          statusCode: 401,
        });
      }
      const body = updateProfileRequestSchema.parse(req.body);
      const user = await service.updateProfile(req.user.userId, body);
      res.status(200).json({ data: user });
    },

    async deactivate(req: Request, res: Response): Promise<void> {
      if (!req.user) {
        throw new AppError({
          code: ErrorCodes.AUTH_REQUIRED,
          message: 'Authentication required.',
          statusCode: 401,
        });
      }
      await service.deactivate(req.user.userId);
      clearAuthCookies(res);
      res.status(204).send();
    },
  };
}
