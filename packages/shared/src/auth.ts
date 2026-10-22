import { z } from 'zod';

import { SUPPORTED_LOCALES } from './locales.js';

export const passwordSchema = z
  .string()
  .min(10, 'Password must be at least 10 characters.')
  .max(128, 'Password must be at most 128 characters.');

export const displayNameSchema = z
  .string()
  .trim()
  .min(2, 'Display name must be at least 2 characters.')
  .max(80, 'Display name must be at most 80 characters.');

export const emailSchema = z.string().trim().email('Enter a valid email address.').max(254);

export const preferredLocaleSchema = z.enum(SUPPORTED_LOCALES);

export const registerRequestSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  displayName: displayNameSchema,
  preferredLocale: preferredLocaleSchema.default('ar'),
  acceptTerms: z.literal(true, {
    errorMap: () => ({ message: 'You must accept the terms to register.' }),
  }),
});

export const loginRequestSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(128),
});

export const verifyEmailRequestSchema = z.object({
  token: z.string().min(20).max(512),
});

export const resendVerificationRequestSchema = z.object({
  email: emailSchema,
});

export const forgotPasswordRequestSchema = z.object({
  email: emailSchema,
});

export const resetPasswordRequestSchema = z.object({
  token: z.string().min(20).max(512),
  password: passwordSchema,
});

export const updateProfileRequestSchema = z.object({
  displayName: displayNameSchema.optional(),
  bio: z.string().trim().max(500).nullable().optional(),
  city: z.string().trim().max(80).nullable().optional(),
  area: z.string().trim().max(80).nullable().optional(),
  preferredLocale: preferredLocaleSchema.optional(),
});

export const publicUserProfileSchema = z.object({
  displayName: z.string(),
  bio: z.string().nullable(),
  city: z.string().nullable(),
  area: z.string().nullable(),
  preferredLocale: preferredLocaleSchema,
});

export const publicAuthenticatedUserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  role: z.enum(['USER', 'SUPER_ADMIN']),
  status: z.enum(['ACTIVE', 'SUSPENDED', 'DEACTIVATED']),
  emailVerifiedAt: z.string().datetime({ offset: true }).nullable(),
  createdAt: z.string().datetime({ offset: true }),
  profile: publicUserProfileSchema,
});

export type RegisterRequest = z.infer<typeof registerRequestSchema>;
export type LoginRequest = z.infer<typeof loginRequestSchema>;
export type UpdateProfileRequest = z.infer<typeof updateProfileRequestSchema>;
export type PublicAuthenticatedUser = z.infer<typeof publicAuthenticatedUserSchema>;

export const AUTH_ERROR_CODES = [
  'VALIDATION_ERROR',
  'INVALID_CREDENTIALS',
  'EMAIL_NOT_VERIFIED',
  'ACCOUNT_SUSPENDED',
  'ACCOUNT_DEACTIVATED',
  'AUTH_REQUIRED',
  'ACCESS_TOKEN_EXPIRED',
  'INVALID_REFRESH_TOKEN',
  'SESSION_REVOKED',
  'CSRF_INVALID',
  'EMAIL_ALREADY_REGISTERED',
  'VERIFICATION_TOKEN_INVALID',
  'VERIFICATION_TOKEN_EXPIRED',
  'RESET_TOKEN_INVALID',
  'RESET_TOKEN_EXPIRED',
  'RATE_LIMITED',
  'NOT_FOUND',
  'INTERNAL_ERROR',
] as const;

export type AuthErrorCode = (typeof AUTH_ERROR_CODES)[number];
