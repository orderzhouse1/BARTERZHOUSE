import { z } from 'zod';

import { apiSuccessSchema } from './api.js';

export const healthDataSchema = z.object({
  status: z.literal('ok'),
  service: z.literal('barterhouse-api'),
  timestamp: z.string().datetime({ offset: true }),
});

export const healthResponseSchema = apiSuccessSchema(healthDataSchema);

export type HealthData = z.infer<typeof healthDataSchema>;
export type HealthResponse = z.infer<typeof healthResponseSchema>;
