import type { PublicAuthenticatedUser } from '@barterzhouse/shared';

import type { UserWithProfile } from '../modules/auth/auth.types.js';

export function serializeUser(user: UserWithProfile): PublicAuthenticatedUser {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    status: user.status,
    emailVerifiedAt: user.emailVerifiedAt ? user.emailVerifiedAt.toISOString() : null,
    createdAt: user.createdAt.toISOString(),
    profile: {
      displayName: user.profile.displayName,
      bio: user.profile.bio,
      city: user.profile.city,
      area: user.profile.area,
      preferredLocale: user.profile.preferredLocale,
    },
  };
}
