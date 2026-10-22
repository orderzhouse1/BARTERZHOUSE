import { logger } from '../../lib/logger.js';
import type { EmailDelivery } from './types.js';

/**
 * Phase 1 ships without a real transactional email provider wired up. This adapter
 * intentionally no-ops (rather than throwing, which would break registration /
 * password-reset flows) and never logs the token/url so secrets can't leak into logs.
 */
export class ProductionEmailAdapter implements EmailDelivery {
  async sendVerificationEmail(to: string): Promise<void> {
    logger.warn(
      { to },
      'Production email delivery is not configured; verification email was not sent.',
    );
  }

  async sendPasswordResetEmail(to: string): Promise<void> {
    logger.warn(
      { to },
      'Production email delivery is not configured; password reset email was not sent.',
    );
  }
}
