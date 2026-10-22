export type EmailMessageKind = 'verification' | 'password-reset';

export interface EmailMessage {
  to: string;
  kind: EmailMessageKind;
  url: string;
  sentAt: Date;
}

export interface EmailDelivery {
  sendVerificationEmail(to: string, url: string): Promise<void>;
  sendPasswordResetEmail(to: string, url: string): Promise<void>;
}
