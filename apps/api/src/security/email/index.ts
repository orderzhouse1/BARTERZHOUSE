import type { ApiEnv } from '../../config/env.js';
import { DevelopmentEmailAdapter } from './development-adapter.js';
import { EmailConfigurationError, PRODUCTION_EMAIL_UNAVAILABLE } from './errors.js';
import { MemoryEmailAdapter } from './memory-adapter.js';
import type { EmailDelivery } from './types.js';

export * from './types.js';
export { DevelopmentEmailAdapter } from './development-adapter.js';
export { MemoryEmailAdapter } from './memory-adapter.js';
export { ProductionEmailAdapter } from './production-adapter.js';

export function createEmailDelivery(
  env: Pick<ApiEnv, 'NODE_ENV' | 'EMAIL_DELIVERY_MODE'>,
): EmailDelivery {
  if (
    (env.NODE_ENV === 'production' || process.env.NODE_ENV === 'production') &&
    env.EMAIL_DELIVERY_MODE !== 'production'
  ) {
    throw new EmailConfigurationError('Local email modes are forbidden in production.');
  }

  switch (env.EMAIL_DELIVERY_MODE) {
    case 'memory':
      return new MemoryEmailAdapter();
    case 'production':
      throw new EmailConfigurationError(PRODUCTION_EMAIL_UNAVAILABLE);
    case 'development':
      return new DevelopmentEmailAdapter(env.NODE_ENV);
    default:
      throw new EmailConfigurationError('Unsupported email delivery mode.');
  }
}
