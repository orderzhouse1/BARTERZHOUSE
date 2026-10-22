import type { NextFunction, Request, Response } from 'express';

import { logger } from '../lib/logger.js';

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const startedAt = Date.now();

  res.on('finish', () => {
    logger.info(
      {
        requestId: req.requestId,
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        durationMs: Date.now() - startedAt,
      },
      'request completed',
    );
  });

  next();
}
