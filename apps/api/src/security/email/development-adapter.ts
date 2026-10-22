import { logger } from '../../lib/logger.js';
import type { EmailDelivery } from './types.js';

/**
 * Logs clearly-labeled DEV-ONLY links instead of sending real email. Must never be
 * selected in production (see createEmailDelivery).
 */
export class DevelopmentEmailAdapter implements EmailDelivery {
  async sendVerificationEmail(to: string, url: string): Promise<void> {
    logger.info({ to, url }, '[DEV-ONLY] Email verification link (no real email was sent)');
  }

  async sendPasswordResetEmail(to: string, url: string): Promise<void> {
    logger.info({ to, url }, '[DEV-ONLY] Password reset link (no real email was sent)');
  }
}
