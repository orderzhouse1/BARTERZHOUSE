import type { NextFunction, Request, Response } from 'express';

import { AppError } from '../errors/app-error.js';
import { ErrorCodes } from '../errors/codes.js';

export function notFoundHandler(req: Request, _res: Response, next: NextFunction): void {
  next(
    new AppError({
      code: ErrorCodes.NOT_FOUND,
      message: `Route not found: ${req.method} ${req.path}`,
      statusCode: 404,
    }),
  );
}
