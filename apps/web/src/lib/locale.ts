import { DEFAULT_LOCALE, isLocale, type Locale } from '@barterzhouse/shared';

export function resolveLocale(value: string | undefined): Locale {
  if (value && isLocale(value)) {
    return value;
  }

  return DEFAULT_LOCALE;
}
