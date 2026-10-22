import { describe, expect, it } from 'vitest';

import { healthResponseSchema } from './health.js';
import { DEFAULT_LOCALE, getLocaleDirection, isLocale, SUPPORTED_LOCALES } from './locales.js';

describe('locales', () => {
  it('defaults to Arabic', () => {
    expect(DEFAULT_LOCALE).toBe('ar');
    expect(getLocaleDirection('ar')).toBe('rtl');
    expect(getLocaleDirection('en')).toBe('ltr');
  });

  it('validates supported locales only', () => {
    expect(isLocale('ar')).toBe(true);
    expect(isLocale('en')).toBe(true);
    expect(isLocale('fr')).toBe(false);
    expect(SUPPORTED_LOCALES).toEqual(['ar', 'en']);
  });
});

describe('healthResponseSchema', () => {
  it('accepts a valid health payload', () => {
    const result = healthResponseSchema.safeParse({
      data: {
        status: 'ok',
        service: 'barterhouse-api',
        timestamp: '2026-08-02T11:00:00.000Z',
      },
    });

    expect(result.success).toBe(true);
  });

  it('rejects an invalid health payload', () => {
    const result = healthResponseSchema.safeParse({
      data: {
        status: 'down',
        service: 'barterhouse-api',
        timestamp: 'not-a-date',
      },
    });

    expect(result.success).toBe(false);
  });
});
