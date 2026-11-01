import { afterEach, describe, expect, it, vi } from 'vitest';

import { createApp } from '../../app.js';
import { loadEnv } from '../../config/env.js';
import { resetEnvCache } from '../../config/index.js';
import { logger } from '../../lib/logger.js';
import { DevelopmentEmailAdapter } from './development-adapter.js';
import {
  EmailConfigurationError,
  EmailDeliveryError,
  PRODUCTION_EMAIL_UNAVAILABLE,
} from './errors.js';
import { createEmailDelivery } from './index.js';
import { MemoryEmailAdapter } from './memory-adapter.js';
import { ProductionEmailAdapter } from './production-adapter.js';

// Synthetic configuration only; parsing never opens a database connection.
function configuration(overrides: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  return {
    NODE_ENV: 'development',
    WEB_ORIGIN: 'http://localhost:3000',
    JWT_ACCESS_SECRET: 'email-test-access-'.repeat(4),
    JWT_REFRESH_SECRET: 'email-test-refresh-'.repeat(4),
    CSRF_SECRET: 'email-test-csrf-'.repeat(4),
    ...overrides,
  };
}

function productionConfiguration(overrides: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  return configuration({
    NODE_ENV: 'production',
    AUTH_PERSISTENCE: 'prisma',
    DATABASE_URL: 'postgresql://test:test@127.0.0.1:1/test',
    ...overrides,
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  resetEnvCache();
});

describe('production email environment validation', () => {
  it.each([undefined, 'development', 'memory'])('rejects production with email mode %s', (mode) => {
    expect(() => loadEnv(productionConfiguration({ EMAIL_DELIVERY_MODE: mode }))).toThrow(
      'local email modes are forbidden',
    );
  });

  it('rejects production mode until a real provider is implemented', () => {
    expect(() =>
      loadEnv(
        productionConfiguration({
          EMAIL_DELIVERY_MODE: 'production',
          EMAIL_FROM: 'test@example.invalid',
        }),
      ),
    ).toThrow(PRODUCTION_EMAIL_UNAVAILABLE);
  });

  it('rejects production mode with missing provider configuration', () => {
    expect(() => loadEnv(productionConfiguration({ EMAIL_DELIVERY_MODE: 'production' }))).toThrow(
      PRODUCTION_EMAIL_UNAVAILABLE,
    );
  });

  it.each(['NODE_ENV', 'EMAIL_DELIVERY_MODE'])(
    'does not echo an invalid %s value into configuration errors',
    (key) => {
      const sensitiveValue = 'https://example.invalid/reset?token=synthetic-private-value';
      try {
        loadEnv(configuration({ [key]: sensitiveValue }));
        throw new Error('Expected configuration rejection');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        const message = (error as Error).message;
        expect(message).toContain(key);
        expect(message).toContain('Expected a supported configuration value.');
        expect(message).not.toContain(sensitiveValue);
        expect(message).not.toContain('synthetic-private-value');
      }
    },
  );

  it('keeps URL validation errors free of the rejected token-bearing URL', () => {
    const rejectedUrl = 'invalid-url?token=synthetic-secret';
    expect(() => loadEnv(configuration({ PASSWORD_RESET_URL: rejectedUrl }))).toThrow(
      'PASSWORD_RESET_URL',
    );
    expect(() => loadEnv(configuration({ PASSWORD_RESET_URL: rejectedUrl }))).not.toThrow(
      rejectedUrl,
    );
  });

  it.each(['development', 'memory'] as const)('accepts local %s mode', (mode) => {
    const env = loadEnv(configuration({ EMAIL_DELIVERY_MODE: mode }));
    expect(env.EMAIL_DELIVERY_MODE).toBe(mode);
    expect(env.AUTH_PERSISTENCE).toBe('memory');
  });

  it('keeps the local default in development mode', () => {
    expect(loadEnv(configuration()).EMAIL_DELIVERY_MODE).toBe('development');
  });

  it('refuses application startup in production before constructing a datastore', () => {
    const raw = productionConfiguration({ EMAIL_DELIVERY_MODE: 'production' });
    for (const [key, value] of Object.entries(raw)) vi.stubEnv(key, value);
    resetEnvCache();
    expect(() => createApp()).toThrow(PRODUCTION_EMAIL_UNAVAILABLE);
  });
});

describe('email factory fails closed', () => {
  it.each(['development', 'memory'] as const)('forbids %s with production flags', (mode) => {
    expect(() =>
      createEmailDelivery({ NODE_ENV: 'production', EMAIL_DELIVERY_MODE: mode }),
    ).toThrow(EmailConfigurationError);
  });

  it.each(['development', 'memory'] as const)(
    'checks the runtime production flag before selecting %s',
    (mode) => {
      vi.stubEnv('NODE_ENV', 'production');
      expect(() =>
        createEmailDelivery({ NODE_ENV: 'development', EMAIL_DELIVERY_MODE: mode }),
      ).toThrow(EmailConfigurationError);
    },
  );

  it.each(['development', 'test', 'production'] as const)(
    'rejects the unavailable provider in %s',
    (environment) => {
      expect(() =>
        createEmailDelivery({ NODE_ENV: environment, EMAIL_DELIVERY_MODE: 'production' }),
      ).toThrow(PRODUCTION_EMAIL_UNAVAILABLE);
    },
  );

  it('does not silently fall back when the mode is invalid at runtime', () => {
    expect(() =>
      createEmailDelivery({
        NODE_ENV: 'development',
        EMAIL_DELIVERY_MODE: 'invalid' as 'development',
      }),
    ).toThrow('Unsupported email delivery mode.');
  });

  it('selects the local development adapter', () => {
    expect(
      createEmailDelivery({ NODE_ENV: 'development', EMAIL_DELIVERY_MODE: 'development' }),
    ).toBeInstanceOf(DevelopmentEmailAdapter);
  });

  it('selects the isolated memory adapter for tests', () => {
    expect(createEmailDelivery({ NODE_ENV: 'test', EMAIL_DELIVERY_MODE: 'memory' })).toBeInstanceOf(
      MemoryEmailAdapter,
    );
  });
});

describe('adapter logging and delivery safety', () => {
  const recipient = 'local-test@example.invalid';
  const url = 'https://example.invalid/verify?token=synthetic-email-token';
  const methods = ['sendVerificationEmail', 'sendPasswordResetEmail'] as const;

  it.each(methods)('%s prints an explicitly DEV-ONLY link locally', async (method) => {
    vi.stubEnv('NODE_ENV', 'development');
    const log = vi.spyOn(logger, 'info').mockImplementation(() => undefined);
    await new DevelopmentEmailAdapter('development')[method](recipient, url);
    expect(log).toHaveBeenCalledWith({ to: recipient, url }, expect.stringContaining('[DEV-ONLY]'));
  });

  it('rejects direct development adapter construction for production', () => {
    const log = vi.spyOn(logger, 'info').mockImplementation(() => undefined);
    expect(() => new DevelopmentEmailAdapter('production')).toThrow(EmailConfigurationError);
    expect(log).not.toHaveBeenCalled();
  });

  it.each(methods)('%s cannot log after the runtime switches to production', async (method) => {
    const adapter = new DevelopmentEmailAdapter('development');
    const log = vi.spyOn(logger, 'info').mockImplementation(() => undefined);
    vi.stubEnv('NODE_ENV', 'production');
    await expect(adapter[method](recipient, url)).rejects.toBeInstanceOf(EmailConfigurationError);
    expect(log).not.toHaveBeenCalled();
  });

  it.each(methods)('%s on the production placeholder rejects without logging', async (method) => {
    vi.stubEnv('NODE_ENV', 'production');
    const info = vi.spyOn(logger, 'info').mockImplementation(() => undefined);
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
    const error = vi.spyOn(logger, 'error').mockImplementation(() => undefined);
    await expect(new ProductionEmailAdapter()[method](recipient, url)).rejects.toBeInstanceOf(
      EmailDeliveryError,
    );
    expect(info).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  });

  it('memory mode captures both messages without logging or sending externally', async () => {
    const info = vi.spyOn(logger, 'info').mockImplementation(() => undefined);
    const adapter = new MemoryEmailAdapter();
    await adapter.sendVerificationEmail(recipient, url);
    await adapter.sendPasswordResetEmail(recipient, url);
    expect(adapter.messages.map((message) => message.kind)).toEqual([
      'verification',
      'password-reset',
    ]);
    expect(info).not.toHaveBeenCalled();
  });
});
