import { describe, expect, it } from 'vitest';

import { webEnvSchemaForTests } from '@/config/env';
import { resolveLocale } from '@/lib/locale';

describe('resolveLocale', () => {
  it('returns Arabic for invalid locales', () => {
    expect(resolveLocale('fr')).toBe('ar');
    expect(resolveLocale(undefined)).toBe('ar');
  });

  it('returns the requested supported locale', () => {
    expect(resolveLocale('en')).toBe('en');
    expect(resolveLocale('ar')).toBe('ar');
  });
});

describe('webEnvSchemaForTests', () => {
  it('accepts valid public URLs', () => {
    const result = webEnvSchemaForTests.safeParse({
      NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
      NEXT_PUBLIC_API_URL: 'http://localhost:4000/api/v1',
    });

    expect(result.success).toBe(true);
  });

  it('rejects malformed public URLs', () => {
    const result = webEnvSchemaForTests.safeParse({
      NEXT_PUBLIC_APP_URL: 'localhost',
      NEXT_PUBLIC_API_URL: 'not-a-url',
    });

    expect(result.success).toBe(false);
  });
});
