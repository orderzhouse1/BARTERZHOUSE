process.env.NODE_ENV = 'test';
process.env.WEB_ORIGIN = 'http://localhost:3000';
process.env.PORT = '4000';

// Test-only secrets — never used outside the vitest process, safe to hardcode.
process.env.JWT_ACCESS_SECRET = 'test-jwt-access-secret-please-do-not-use-in-prod';
process.env.JWT_REFRESH_SECRET = 'test-jwt-refresh-secret-please-do-not-use-in-prod';
process.env.CSRF_SECRET = 'test-csrf-secret-please-do-not-use-in-production';

process.env.AUTH_PERSISTENCE = 'memory';
process.env.EMAIL_DELIVERY_MODE = 'memory';

// Prevent empty COOKIE_DOMAIN= from local .env from failing validation.
if (process.env.COOKIE_DOMAIN === '') {
  delete process.env.COOKIE_DOMAIN;
}
