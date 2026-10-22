import type { Request, Response } from 'express';

import type { HealthResponse } from '@barterzhouse/shared';

import { getHealthData } from './health.service.js';

export function healthController(_req: Request, res: Response): void {
  const body: HealthResponse = {
    data: getHealthData(),
  };

  res.status(200).json(body);
}
