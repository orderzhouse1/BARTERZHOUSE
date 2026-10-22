import type { PublicAuthenticatedUser, UpdateProfileRequest } from '@barterzhouse/shared';

import type { AuthStore } from '../auth/auth.types.js';
import { serializeUser } from '../../security/serialize-user.js';

export class UsersService {
  constructor(private readonly store: AuthStore) {}

  async updateProfile(
    userId: string,
    patch: UpdateProfileRequest,
  ): Promise<PublicAuthenticatedUser> {
    const user = await this.store.updateProfile(userId, patch);
    return serializeUser(user);
  }

  async deactivate(userId: string): Promise<void> {
    const now = new Date();
    await this.store.deactivateUser(userId, now);
    await this.store.revokeAllUserSessions(userId, 'ACCOUNT_DEACTIVATED', now);
    await this.store.writeAuditLog({ userId, event: 'ACCOUNT_DEACTIVATED' });
  }
}
