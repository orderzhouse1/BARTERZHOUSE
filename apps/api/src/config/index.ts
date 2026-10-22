import type { ApiEnv } from './env.js';
import { loadEnv } from './env.js';

let cached: ApiEnv | undefined;

export function getEnv(): ApiEnv {
  if (!cached) {
    cached = loadEnv();
  }

  return cached;
}

export function resetEnvCache(): void {
  cached = undefined;
}
