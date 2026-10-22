import { z } from 'zod';

export const apiSuccessSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    data: dataSchema,
    meta: z.record(z.unknown()).optional(),
  });

export const apiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    fieldErrors: z.record(z.array(z.string())).optional(),
    requestId: z.string().optional(),
  }),
});

export type ApiErrorBody = z.infer<typeof apiErrorSchema>;

export type ApiSuccessBody<T> = {
  data: T;
  meta?: Record<string, unknown>;
};
