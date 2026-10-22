import { createApp } from './app.js';
import { getEnv } from './config/index.js';
import { logger } from './lib/logger.js';

const env = getEnv();
const app = createApp();

const server = app.listen(env.PORT, () => {
  logger.info({ port: env.PORT, env: env.NODE_ENV }, 'API server listening');
});

function shutdown(signal: string): void {
  logger.info({ signal }, 'Shutting down API server');
  server.close((error) => {
    if (error) {
      logger.error({ err: error }, 'Error during server shutdown');
      process.exit(1);
    }

    process.exit(0);
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
