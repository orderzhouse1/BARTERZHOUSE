import { describe, expect, it } from 'vitest';

import { AUTH_ERROR_CODES, SUPPORTED_LOCALES } from '@barterzhouse/shared';

import { getAuthErrorMessage, getDictionary } from '@/i18n/dictionaries';

describe('getDictionary', () => {
  it('returns a dictionary with auth and account namespaces for every supported locale', () => {
    for (const locale of SUPPORTED_LOCALES) {
      const dictionary = getDictionary(locale);
      expect(dictionary.auth.login.title).toBeTruthy();
      expect(dictionary.auth.register.title).toBeTruthy();
      expect(dictionary.account.nav.overview).toBeTruthy();
    }
  });

  it('has a localized error message for every server auth error code', () => {
    for (const locale of SUPPORTED_LOCALES) {
      const dictionary = getDictionary(locale);
      for (const code of AUTH_ERROR_CODES) {
        expect(dictionary.auth.errors[code]).toBeTruthy();
      }
    }
  });
});

describe('getAuthErrorMessage', () => {
  it('returns the mapped message for a known code', () => {
    const dictionary = getDictionary('en');
    expect(getAuthErrorMessage(dictionary, 'INVALID_CREDENTIALS')).toBe(
      dictionary.auth.errors.INVALID_CREDENTIALS,
    );
  });

  it('falls back to UNKNOWN_ERROR for an unrecognized code', () => {
    const dictionary = getDictionary('en');
    expect(getAuthErrorMessage(dictionary, 'SOMETHING_NEW')).toBe(
      dictionary.auth.errors.UNKNOWN_ERROR,
    );
  });
});
