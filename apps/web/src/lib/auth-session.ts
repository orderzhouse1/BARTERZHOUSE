import type { PublicAuthenticatedUser } from '@barterzhouse/shared';

import { apiClient } from '@/lib/api-client';

export type AuthUser = PublicAuthenticatedUser;

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

/**
 * Resolves the current session by calling GET /auth/me.
 * The api-client transparently attempts one token refresh on 401 before
 * giving up, so a `null` result here means the visitor is truly signed out.
 */
export async function fetchMe(): Promise<AuthUser | null> {
  try {
    return await apiClient.getMe();
  } catch {
    return null;
  }
}

export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) {
    return '?';
  }

  if (parts.length === 1) {
    return parts[0]!.slice(0, 2).toUpperCase();
  }

  return `${parts[0]![0]}${parts[parts.length - 1]![0]}`.toUpperCase();
}

export function isEmailVerified(user: AuthUser): boolean {
  return user.emailVerifiedAt !== null;
}
