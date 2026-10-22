import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';

import { getEnv } from './config/index.js';
import { errorHandler } from './middleware/error-handler.js';
import { notFoundHandler } from './middleware/not-found.js';
import { requestIdMiddleware } from './middleware/request-id.js';
import { requestLogger } from './middleware/request-logger.js';
import { createAuthRouter } from './modules/auth/auth.routes.js';
import type { AuthStore } from './modules/auth/auth.types.js';
import { MemoryAuthStore } from './modules/auth/stores/memory-auth-store.js';
import { getPrismaAuthStore } from './modules/auth/stores/prisma-auth-store.js';
import { healthRouter } from './modules/health/health.routes.js';
import { createUsersRouter } from './modules/users/users.routes.js';
import { createEmailDelivery } from './security/email/index.js';
import type { EmailDelivery } from './security/email/types.js';

export interface CreateAppOptions {
  authStore?: AuthStore;
  emailDelivery?: EmailDelivery;
}

export function createApp(options: CreateAppOptions = {}): Express {
  const env = getEnv();
  const app = express();

  app.disable('x-powered-by');

  app.use(requestIdMiddleware);

  if (env.NODE_ENV !== 'test') {
    app.use(requestLogger);
  }

  app.use(
    helmet({
      contentSecurityPolicy: false,
    }),
  );
  app.use(
    cors({
      origin: env.WEB_ORIGIN,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());

  const authStore =
    options.authStore ??
    (env.AUTH_PERSISTENCE === 'prisma' ? getPrismaAuthStore() : new MemoryAuthStore());
  const emailDelivery = options.emailDelivery ?? createEmailDelivery(env);

  app.use('/health', healthRouter);
  app.use('/api/v1/health', healthRouter);
  app.use('/api/v1/auth', createAuthRouter(authStore, emailDelivery));
  app.use('/api/v1/users', createUsersRouter(authStore));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
