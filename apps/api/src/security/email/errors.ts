import { AppError } from '../../errors/app-error.js';
import { ErrorCodes } from '../../errors/codes.js';

export const PRODUCTION_EMAIL_UNAVAILABLE =
  'Production email delivery is unavailable: no email provider is implemented.';

export class EmailConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EmailConfigurationError';
  }
}

// Never attach provider errors, recipients, token URLs, or causes to this error.
export class EmailDeliveryError extends AppError {
  constructor() {
    super({
      code: ErrorCodes.INTERNAL_ERROR,
      message: 'Email delivery is temporarily unavailable.',
      statusCode: 503,
    });
    this.name = 'EmailDeliveryError';
  }
}
