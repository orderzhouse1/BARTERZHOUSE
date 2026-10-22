import { createHmac, randomBytes } from 'node:crypto';

import { getEnv } from '../config/index.js';
import { timingSafeStringEqual } from './tokens.js';

function signCsrfNonce(nonce: string): string {
  const env = getEnv();
  return createHmac('sha256', env.CSRF_SECRET).update(nonce).digest('base64url');
}

export function createCsrfToken(): string {
  const nonce = randomBytes(24).toString('base64url');
  return `${nonce}.${signCsrfNonce(nonce)}`;
}

export function isValidCsrfToken(token: string): boolean {
  const [nonce, signature] = token.split('.');

  if (!nonce || !signature) {
    return false;
  }

  return timingSafeStringEqual(signature, signCsrfNonce(nonce));
}
