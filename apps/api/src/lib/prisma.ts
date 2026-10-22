import { PrismaClient } from '@prisma/client';

import { getEnv } from '../config/index.js';

let client: PrismaClient | undefined;

/**
 * Lazily instantiates the Prisma client. Never called unless AUTH_PERSISTENCE=prisma,
 * so DB-less local runs and the in-memory test suite never touch @prisma/client.
 */
export function getPrismaClient(): PrismaClient {
  if (!client) {
    const env = getEnv();

    if (!env.DATABASE_URL) {
      throw new Error('DATABASE_URL is required to initialize the Prisma client.');
    }

    client = new PrismaClient({
      datasourceUrl: env.DATABASE_URL,
    });
  }

  return client;
}

export async function disconnectPrisma(): Promise<void> {
  if (client) {
    await client.$disconnect();
    client = undefined;
  }
}
