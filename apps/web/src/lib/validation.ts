const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(value: string): boolean {
  return EMAIL_PATTERN.test(value.trim());
}

export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_LENGTH = 128;
export const DISPLAY_NAME_MIN_LENGTH = 2;
export const DISPLAY_NAME_MAX_LENGTH = 80;

/** Only relative, in-app paths are safe redirect targets (avoids open redirects). */
export function sanitizeNextPath(value: string | null, fallback: string): string {
  if (value && value.startsWith('/') && !value.startsWith('//')) {
    return value;
  }
  return fallback;
}
