import type { EmailDelivery, EmailMessage, EmailMessageKind } from './types.js';

/**
 * Captures outgoing messages in memory instead of sending them. Intended for tests,
 * which can inspect `.messages` to assert on verification / reset links.
 */
export class MemoryEmailAdapter implements EmailDelivery {
  readonly messages: EmailMessage[] = [];

  async sendVerificationEmail(to: string, url: string): Promise<void> {
    this.messages.push({ to, kind: 'verification', url, sentAt: new Date() });
  }

  async sendPasswordResetEmail(to: string, url: string): Promise<void> {
    this.messages.push({ to, kind: 'password-reset', url, sentAt: new Date() });
  }

  clear(): void {
    this.messages.length = 0;
  }

  findLatestFor(to: string, kind: EmailMessageKind): EmailMessage | undefined {
    for (let i = this.messages.length - 1; i >= 0; i -= 1) {
      const message = this.messages[i];
      if (message && message.to === to && message.kind === kind) {
        return message;
      }
    }
    return undefined;
  }
}
