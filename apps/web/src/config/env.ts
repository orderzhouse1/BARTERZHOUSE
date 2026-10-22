import { z } from 'zod';

const webEnvSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url(),
  NEXT_PUBLIC_API_URL: z.string().url(),
});

export type WebEnv = z.infer<typeof webEnvSchema>;

let cached: WebEnv | undefined;

export function getWebEnv(): WebEnv {
  if (cached) {
    return cached;
  }

  const parsed = webEnvSchema.safeParse({
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  });

  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');

    throw new Error(`Invalid web environment configuration:\n${details}`);
  }

  cached = parsed.data;
  return cached;
}

export const webEnvSchemaForTests = webEnvSchema;
