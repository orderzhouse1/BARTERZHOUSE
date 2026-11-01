import { EmailDeliveryError } from './errors.js';
import type { EmailDelivery } from './types.js';

/**
 * No production provider is implemented. The factory refuses this mode at startup;
 * direct calls also reject rather than falsely reporting successful delivery.
 */
export class ProductionEmailAdapter implements EmailDelivery {
  async sendVerificationEmail(_to: string, _url: string): Promise<void> {
    throw new EmailDeliveryError();
  }

  async sendPasswordResetEmail(_to: string, _url: string): Promise<void> {
    throw new EmailDeliveryError();
  }
}
