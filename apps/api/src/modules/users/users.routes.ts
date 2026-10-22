import { Router } from 'express';

import { createRequireAuth } from '../../middleware/require-auth.js';
import { requireCsrf } from '../../middleware/require-csrf.js';
import type { AuthStore } from '../auth/auth.types.js';
import { createUsersController } from './users.controller.js';
import { UsersService } from './users.service.js';

export function createUsersRouter(store: AuthStore): Router {
  const router = Router();
  const service = new UsersService(store);
  const controller = createUsersController(service);
  const requireAuth = createRequireAuth(store);

  router.patch('/me', requireAuth, requireCsrf, controller.updateProfile);
  router.post('/me/deactivate', requireAuth, requireCsrf, controller.deactivate);

  return router;
}
