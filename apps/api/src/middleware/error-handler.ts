import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';

import type { ApiErrorBody } from '@barterzhouse/shared';

import { isAppError } from '../errors/app-error.js';
import { ErrorCodes } from '../errors/codes.js';
import { logger } from '../lib/logger.js';

export function errorHandler(
  error: unknown,
  req: Request,
  res: Response,
  // Express requires 4-arity error middleware; next is unused by design.
  next: NextFunction,
): void {
  void next;

  const requestId = req.requestId;

  if (error instanceof ZodError) {
    const fieldErrors: Record<string, string[]> = {};

    for (const issue of error.issues) {
      const key = issue.path.join('.') || '_root';
      const current = fieldErrors[key] ?? [];
      current.push(issue.message);
      fieldErrors[key] = current;
    }

    const body: ApiErrorBody = {
      error: {
        code: ErrorCodes.VALIDATION_ERROR,
        message: 'Request validation failed.',
        fieldErrors,
        requestId,
      },
    };

    res.status(400).json(body);
    return;
  }

  if (isAppError(error)) {
    const body: ApiErrorBody = {
      error: {
        code: error.code,
        message: error.message,
        fieldErrors: error.fieldErrors,
        requestId,
      },
    };

    res.status(error.statusCode).json(body);
    return;
  }

  logger.error({ err: error, requestId }, 'Unhandled API error');

  const body: ApiErrorBody = {
    error: {
      code: ErrorCodes.INTERNAL_ERROR,
      message: 'An unexpected error occurred.',
      requestId,
    },
  };

  res.status(500).json(body);
}
