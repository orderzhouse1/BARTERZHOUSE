import type { ApiEnv } from '../../config/env.js';
import { DevelopmentEmailAdapter } from './development-adapter.js';
import { MemoryEmailAdapter } from './memory-adapter.js';
import { ProductionEmailAdapter } from './production-adapter.js';
import type { EmailDelivery } from './types.js';

export * from './types.js';
export { DevelopmentEmailAdapter } from './development-adapter.js';
export { MemoryEmailAdapter } from './memory-adapter.js';
export { ProductionEmailAdapter } from './production-adapter.js';

export function createEmailDelivery(env: Pick<ApiEnv, 'EMAIL_DELIVERY_MODE'>): EmailDelivery {
  switch (env.EMAIL_DELIVERY_MODE) {
    case 'memory':
      return new MemoryEmailAdapter();
    case 'production':
      return new ProductionEmailAdapter();
    case 'development':
    default:
      return new DevelopmentEmailAdapter();
  }
}
