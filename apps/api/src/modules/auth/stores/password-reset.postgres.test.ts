import { randomUUID } from 'node:crypto';

import { PrismaClient } from '@prisma/client';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { PrismaAuthStore } from './prisma-auth-store.js';

// Opt-in only. Never falls back to DATABASE_URL. The operator must initialize the
// existing schema in an exclusively disposable, local barterzhouse_task03_test DB.
const testUrl = process.env.TASK03_TEST_DATABASE_URL;
if (process.env.TASK03_REQUIRE_POSTGRES_TESTS === '1' && !testUrl) {
  throw new Error('TASK03_TEST_DATABASE_URL is required; PostgreSQL tests must not be skipped.');
}
const suite = testUrl ? describe : describe.skip;

suite('PostgreSQL password reset integration (explicit disposable database only)', () => {
  let client: PrismaClient | undefined;
  const userIds: string[] = [];

  beforeAll(async () => {
    let url: URL;
    try {
      url = new URL(testUrl!);
    } catch {
      throw new Error('Invalid local Task 03 test database configuration.');
    }
    if (
      !['postgresql:', 'postgres:'].includes(url.protocol) ||
      !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ||
      url.pathname !== '/barterzhouse_task03_test' ||
      [...url.searchParams.keys()].some(
        (key) => !['connection_limit', 'connect_timeout'].includes(key),
      )
    )
      throw new Error('Task 03 integration requires the dedicated local disposable test database.');
    client = new PrismaClient({ datasourceUrl: testUrl });
    await client.$connect();
  });

  afterEach(async () => {
    if (!client || userIds.length === 0) return;
    await client.authAuditLog.deleteMany({ where: { userId: { in: userIds } } });
    await client.user.deleteMany({ where: { id: { in: userIds } } });
    userIds.length = 0;
  });
  afterAll(async () => {
    await client?.$disconnect();
  });

  async function fixture() {
    const store = new PrismaAuthStore(client!);
    const email = `${randomUUID()}@task03.example.invalid`;
    const user = await store.createUserWithProfile({
      email,
      normalizedEmail: email,
      passwordHash: 'old-test-hash',
      displayName: 'PG Reset Test',
      preferredLocale: 'ar',
    });
    userIds.push(user.id);
    for (const tokenHash of ['first', 'second']) {
      await store.createPasswordResetToken({
        userId: user.id,
        tokenHash: `${user.id}-${tokenHash}`,
        expiresAt: new Date(Date.now() + 60_000),
      });
    }
    await store.createSession({
      id: randomUUID(),
      userId: user.id,
      familyId: randomUUID(),
      refreshTokenHash: 'synthetic-test-refresh',
      expiresAt: new Date(Date.now() + 60_000),
    });
    return { store, user, first: `${user.id}-first`, second: `${user.id}-second` };
  }

  it('commits the password, all token invalidations, sessions and audit together', async () => {
    const f = await fixture();
    expect(
      (await f.store.completePasswordReset({ tokenHash: f.first, passwordHash: 'new-test-hash' }))
        .status,
    ).toBe('ok');
    expect((await f.store.findUserById(f.user.id))?.passwordHash).toBe('new-test-hash');
    expect((await f.store.findPasswordResetToken(f.first))?.usedAt).not.toBeNull();
    expect((await f.store.findPasswordResetToken(f.second))?.usedAt).not.toBeNull();
    expect(await client!.authSession.count({ where: { userId: f.user.id, revokedAt: null } })).toBe(
      0,
    );
    expect(
      await client!.authAuditLog.count({ where: { userId: f.user.id, event: 'PASSWORD_RESET' } }),
    ).toBe(1);
  });

  it.each(['same', 'different'] as const)(
    'allows one concurrent reset using %s tokens',
    async (mode) => {
      const f = await fixture();
      const results = await Promise.all([
        f.store.completePasswordReset({ tokenHash: f.first, passwordHash: 'first-new-hash' }),
        f.store.completePasswordReset({
          tokenHash: mode === 'same' ? f.first : f.second,
          passwordHash: 'second-new-hash',
        }),
      ]);
      expect(results.filter((result) => result.status === 'ok')).toHaveLength(1);
      expect(results.filter((result) => result.status === 'used')).toHaveLength(1);
      expect(
        await client!.authAuditLog.count({ where: { userId: f.user.id, event: 'PASSWORD_RESET' } }),
      ).toBe(1);
    },
  );

  it('rolls back real database writes when the final audit query fails', async () => {
    const f = await fixture();
    const failing = client!.$extends({
      query: {
        authAuditLog: {
          async create({ args, query }) {
            if (args.data.userId === f.user.id && args.data.event === 'PASSWORD_RESET')
              throw new Error('Synthetic final audit failure');
            return query(args);
          },
        },
      },
    });
    const store = new PrismaAuthStore(failing as unknown as PrismaClient);
    await expect(
      store.completePasswordReset({ tokenHash: f.first, passwordHash: 'must-roll-back' }),
    ).rejects.toThrow('Synthetic final audit failure');
    expect((await f.store.findUserById(f.user.id))?.passwordHash).toBe('old-test-hash');
    expect((await f.store.findPasswordResetToken(f.first))?.usedAt).toBeNull();
    expect((await f.store.findPasswordResetToken(f.second))?.usedAt).toBeNull();
    expect(await client!.authSession.count({ where: { userId: f.user.id, revokedAt: null } })).toBe(
      1,
    );
    expect(
      await client!.authAuditLog.count({ where: { userId: f.user.id, event: 'PASSWORD_RESET' } }),
    ).toBe(0);

    // The original token must remain usable after rollback, without partial state.
    expect(
      (await f.store.completePasswordReset({ tokenHash: f.first, passwordHash: 'retry-new-hash' }))
        .status,
    ).toBe('ok');
    expect((await f.store.findUserById(f.user.id))?.passwordHash).toBe('retry-new-hash');
    expect((await f.store.findPasswordResetToken(f.first))?.usedAt).not.toBeNull();
    expect((await f.store.findPasswordResetToken(f.second))?.usedAt).not.toBeNull();
    expect(await client!.authSession.count({ where: { userId: f.user.id, revokedAt: null } })).toBe(
      0,
    );
    expect(
      await client!.authAuditLog.count({ where: { userId: f.user.id, event: 'PASSWORD_RESET' } }),
    ).toBe(1);
  });

  it('rejects session creation using credentials checked before a completed reset', async () => {
    const f = await fixture();
    await f.store.completePasswordReset({ tokenHash: f.first, passwordHash: 'new-test-hash' });
    await expect(
      f.store.createSession({
        id: randomUUID(),
        userId: f.user.id,
        familyId: randomUUID(),
        refreshTokenHash: 'synthetic-stale-refresh',
        expiresAt: new Date(Date.now() + 60_000),
        expectedPasswordHash: 'old-test-hash',
      }),
    ).rejects.toThrow('Credentials changed');
    expect(await client!.authSession.count({ where: { userId: f.user.id, revokedAt: null } })).toBe(
      0,
    );
  });
});
