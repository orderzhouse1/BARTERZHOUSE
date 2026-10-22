import argon2 from 'argon2';

import { getEnv } from '../config/index.js';

export async function hashPassword(password: string): Promise<string> {
  const env = getEnv();

  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: env.PASSWORD_HASH_MEMORY_COST,
    timeCost: env.PASSWORD_HASH_TIME_COST,
    parallelism: env.PASSWORD_HASH_PARALLELISM,
  });
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}
