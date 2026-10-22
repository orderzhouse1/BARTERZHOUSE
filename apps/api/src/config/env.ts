import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';

function loadEnvFiles(): void {
  const candidates = [
    resolve(process.cwd(), '.env'),
    resolve(process.cwd(), '../../.env'),
    resolve(process.cwd(), '../../../.env'),
  ];

  for (const path of candidates) {
    if (existsSync(path)) {
      loadDotenv({ path, override: false });
    }
  }
}

loadEnvFiles();

const MIN_SECRET_LENGTH = 32;
const MIN_PRODUCTION_SECRET_LENGTH = 48;

const nodeEnvSchema = z.enum(['development', 'test', 'production']);
const authPersistenceSchema = z.enum(['memory', 'prisma']);
const emailDeliveryModeSchema = z.enum(['memory', 'development', 'production']);
const cookieSameSiteSchema = z.enum(['lax', 'strict', 'none']);

function booleanFromString(defaultValue: boolean) {
  return z.preprocess((value) => {
    if (typeof value !== 'string') {
      return value;
    }
    if (value.toLowerCase() === 'true') return true;
    if (value.toLowerCase() === 'false') return false;
    return value;
  }, z.boolean().default(defaultValue));
}

const baseEnvSchema = z.object({
  NODE_ENV: nodeEnvSchema.default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  WEB_ORIGIN: z.string().url(),

  // Optional except when AUTH_PERSISTENCE=prisma or NODE_ENV=production (enforced below).
  DATABASE_URL: z.string().url().optional(),
  DIRECT_URL: z.string().url().optional(),

  JWT_ACCESS_SECRET: z
    .string()
    .min(MIN_SECRET_LENGTH, `JWT_ACCESS_SECRET must be at least ${MIN_SECRET_LENGTH} characters.`),
  JWT_REFRESH_SECRET: z
    .string()
    .min(MIN_SECRET_LENGTH, `JWT_REFRESH_SECRET must be at least ${MIN_SECRET_LENGTH} characters.`),
  JWT_ISSUER: z.string().min(1).default('barterzhouse-api'),
  JWT_AUDIENCE: z.string().min(1).default('barterzhouse-web'),
  JWT_ACCESS_TTL_MINUTES: z.coerce.number().int().positive().default(15),
  JWT_REFRESH_TTL_DAYS: z.coerce.number().int().positive().default(30),

  CSRF_SECRET: z
    .string()
    .min(MIN_SECRET_LENGTH, `CSRF_SECRET must be at least ${MIN_SECRET_LENGTH} characters.`),

  COOKIE_ACCESS_NAME: z.string().min(1).default('barter_access'),
  COOKIE_REFRESH_NAME: z.string().min(1).default('barter_refresh'),
  COOKIE_CSRF_NAME: z.string().min(1).default('barter_csrf'),
  // Empty string in .env.example must become undefined (not fail min length).
  COOKIE_DOMAIN: z.preprocess(
    (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
    z.string().min(1).optional(),
  ),
  COOKIE_SECURE: booleanFromString(false),
  COOKIE_SAME_SITE: cookieSameSiteSchema.default('lax'),

  PASSWORD_HASH_MEMORY_COST: z.coerce.number().int().positive().default(19456),
  PASSWORD_HASH_TIME_COST: z.coerce.number().int().positive().default(2),
  PASSWORD_HASH_PARALLELISM: z.coerce.number().int().positive().default(1),

  EMAIL_DELIVERY_MODE: emailDeliveryModeSchema.default('development'),
  EMAIL_FROM: z.string().min(1).optional(),
  EMAIL_VERIFICATION_URL: z.string().url().optional(),
  PASSWORD_RESET_URL: z.string().url().optional(),

  AUTH_PERSISTENCE: authPersistenceSchema.optional(),
});

type BaseEnv = z.infer<typeof baseEnvSchema>;

export interface ApiEnv extends Omit<
  BaseEnv,
  'AUTH_PERSISTENCE' | 'EMAIL_VERIFICATION_URL' | 'PASSWORD_RESET_URL'
> {
  AUTH_PERSISTENCE: 'memory' | 'prisma';
  EMAIL_VERIFICATION_URL: string;
  PASSWORD_RESET_URL: string;
}

const envSchema = baseEnvSchema.transform((data, ctx) => {
  const isProduction = data.NODE_ENV === 'production';
  const isTest = data.NODE_ENV === 'test';

  const authPersistence: 'memory' | 'prisma' =
    data.AUTH_PERSISTENCE ??
    (isTest ? 'memory' : isProduction ? 'prisma' : data.DATABASE_URL ? 'prisma' : 'memory');

  let hasError = false;
  const fail = (path: string, message: string): void => {
    hasError = true;
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: [path], message });
  };

  if (isProduction) {
    if (authPersistence !== 'prisma') {
      fail('AUTH_PERSISTENCE', 'AUTH_PERSISTENCE must be "prisma" in production.');
    }
    if (!data.DATABASE_URL) {
      fail('DATABASE_URL', 'DATABASE_URL is required in production.');
    }
    if (data.JWT_ACCESS_SECRET.length < MIN_PRODUCTION_SECRET_LENGTH) {
      fail(
        'JWT_ACCESS_SECRET',
        `JWT_ACCESS_SECRET must be at least ${MIN_PRODUCTION_SECRET_LENGTH} characters in production.`,
      );
    }
    if (data.JWT_REFRESH_SECRET.length < MIN_PRODUCTION_SECRET_LENGTH) {
      fail(
        'JWT_REFRESH_SECRET',
        `JWT_REFRESH_SECRET must be at least ${MIN_PRODUCTION_SECRET_LENGTH} characters in production.`,
      );
    }
    if (data.CSRF_SECRET.length < MIN_PRODUCTION_SECRET_LENGTH) {
      fail(
        'CSRF_SECRET',
        `CSRF_SECRET must be at least ${MIN_PRODUCTION_SECRET_LENGTH} characters in production.`,
      );
    }
    if (data.JWT_ACCESS_SECRET === data.JWT_REFRESH_SECRET) {
      fail(
        'JWT_REFRESH_SECRET',
        'JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different in production.',
      );
    }
  }

  if (authPersistence === 'prisma' && !data.DATABASE_URL) {
    fail('DATABASE_URL', 'DATABASE_URL is required when AUTH_PERSISTENCE=prisma.');
  }

  if (hasError) {
    return z.NEVER;
  }

  const webOrigin = data.WEB_ORIGIN.replace(/\/$/, '');

  return {
    ...data,
    AUTH_PERSISTENCE: authPersistence,
    COOKIE_SECURE: isProduction ? true : data.COOKIE_SECURE,
    EMAIL_VERIFICATION_URL: data.EMAIL_VERIFICATION_URL ?? `${webOrigin}/verify-email`,
    PASSWORD_RESET_URL: data.PASSWORD_RESET_URL ?? `${webOrigin}/reset-password`,
  };
});

export function loadEnv(raw: NodeJS.ProcessEnv = process.env): ApiEnv {
  const parsed = envSchema.safeParse(raw);

  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');

    throw new Error(`Invalid API environment configuration:\n${details}`);
  }

  return parsed.data;
}

export const envSchemaForTests = envSchema;
