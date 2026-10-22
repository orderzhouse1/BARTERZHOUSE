import { describe, expect, it } from 'vitest';

import { loginRequestSchema, registerRequestSchema, updateProfileRequestSchema } from './auth.js';

describe('auth schemas', () => {
  it('accepts a valid registration payload', () => {
    const result = registerRequestSchema.safeParse({
      email: 'User@Example.com',
      password: 'correct-horse-battery',
      displayName: 'Sara',
      preferredLocale: 'ar',
      acceptTerms: true,
    });

    expect(result.success).toBe(true);
  });

  it('rejects short passwords and missing terms', () => {
    expect(
      registerRequestSchema.safeParse({
        email: 'a@b.co',
        password: 'short',
        displayName: 'Sara',
        preferredLocale: 'en',
        acceptTerms: false,
      }).success,
    ).toBe(false);
  });

  it('validates login and profile updates', () => {
    expect(loginRequestSchema.safeParse({ email: 'a@b.co', password: 'x' }).success).toBe(true);
    expect(
      updateProfileRequestSchema.safeParse({
        displayName: 'A',
        city: 'Riyadh',
      }).success,
    ).toBe(false);
    expect(
      updateProfileRequestSchema.safeParse({
        displayName: 'Noura',
        city: 'Riyadh',
        preferredLocale: 'en',
      }).success,
    ).toBe(true);
  });
});
