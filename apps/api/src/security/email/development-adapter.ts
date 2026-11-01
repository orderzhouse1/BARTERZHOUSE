import type { ApiEnv } from '../../config/env.js';
import { logger } from '../../lib/logger.js';
import { EmailConfigurationError } from './errors.js';
import type { EmailDelivery } from './types.js';

/**
 * Logs clearly-labeled DEV-ONLY links instead of sending real email. Must never be
 * selected in production (see createEmailDelivery).
 */
export class DevelopmentEmailAdapter implements EmailDelivery {
  constructor(private readonly environment: ApiEnv['NODE_ENV']) {
    this.assertLocalEnvironment();
  }

  private assertLocalEnvironment(): void {
    if (
      (this.environment !== 'development' && this.environment !== 'test') ||
      process.env.NODE_ENV === 'production'
    ) {
      throw new EmailConfigurationError('Development email delivery requires a local environment.');
    }
  }

  async sendVerificationEmail(to: string, url: string): Promise<void> {
    this.assertLocalEnvironment();
    logger.info({ to, url }, '[DEV-ONLY] Email verification link (no real email was sent)');
  }

  async sendPasswordResetEmail(to: string, url: string): Promise<void> {
    this.assertLocalEnvironment();
    logger.info({ to, url }, '[DEV-ONLY] Password reset link (no real email was sent)');
  }
}
