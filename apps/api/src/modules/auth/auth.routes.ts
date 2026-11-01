import { Router } from 'express';

import { createRequireAuth } from '../../middleware/require-auth.js';
import { requireCsrf } from '../../middleware/require-csrf.js';
import type { EmailDelivery } from '../../security/email/types.js';
import {
  forgotPasswordEmailRateLimiter,
  forgotPasswordRateLimiter,
  loginRateLimiter,
  refreshRateLimiter,
  registerRateLimiter,
  resendVerificationEmailRateLimiter,
  resendVerificationRateLimiter,
  resetPasswordRateLimiter,
  verifyEmailRateLimiter,
} from '../../security/rate-limit.js';
import { createAuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import type { AuthStore } from './auth.types.js';

export function createAuthRouter(store: AuthStore, emailDelivery: EmailDelivery): Router {
  const router = Router();
  const service = new AuthService(store, emailDelivery);
  const controller = createAuthController(service);
  const requireAuth = createRequireAuth(store);

  router.get('/csrf', controller.csrf);

  router.post('/register', registerRateLimiter(), requireCsrf, controller.register);
  router.post('/login', loginRateLimiter(), requireCsrf, controller.login);
  router.post('/refresh', refreshRateLimiter(), requireCsrf, controller.refresh);
  router.post('/logout', requireCsrf, requireAuth, controller.logout);
  router.post('/logout-all', requireCsrf, requireAuth, controller.logoutAll);

  router.post('/verify-email', verifyEmailRateLimiter(), requireCsrf, controller.verifyEmail);
  router.post(
    '/resend-verification',
    resendVerificationRateLimiter(),
    requireCsrf,
    resendVerificationEmailRateLimiter(),
    controller.resendVerification,
  );
  router.post(
    '/forgot-password',
    forgotPasswordRateLimiter(),
    requireCsrf,
    forgotPasswordEmailRateLimiter(),
    controller.forgotPassword,
  );
  router.post('/reset-password', resetPasswordRateLimiter(), requireCsrf, controller.resetPassword);

  router.get('/me', requireAuth, controller.me);

  return router;
}
