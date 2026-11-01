import { Prisma, type PrismaClient } from '@prisma/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { PasswordResetTokenRecord } from '../auth.types.js';
import { PrismaAuthStore } from './prisma-auth-store.js';

// Transaction contract double only. This does NOT verify PostgreSQL lock/rollback semantics.
function fixture() {
  let state = {
    passwordHash: 'old-hash',
    tokens: ['current', 'older'].map((tokenHash): PasswordResetTokenRecord => ({
      id: tokenHash,
      userId: 'test-user',
      tokenHash,
      expiresAt: new Date(Date.now() + 60_000),
      usedAt: null,
      createdAt: new Date(),
    })),
    revoked: false,
    audits: 0,
    createdSessions: 0,
  };
  let failure: 'password' | 'tokens' | 'sessions' | 'audit' | null = null;
  let loseCas = false;
  let invalidateAtLock = false;
  const transactions: Array<ReturnType<typeof transaction>> = [];
  function transaction(draft: typeof state) {
    return {
      $queryRaw: vi.fn(async () => {
        if (invalidateAtLock) draft.tokens[0]!.usedAt = new Date();
        return [{ id: 'test-user', passwordHash: draft.passwordHash }];
      }),
      passwordResetToken: {
        findUnique: vi.fn(async ({ where }: { where: { tokenHash: string } }) => {
          const token = draft.tokens.find((item) => item.tokenHash === where.tokenHash);
          return token ? { ...token } : null;
        }),
        updateMany: vi.fn(
          async (input: { where: { tokenHash?: string }; data: { usedAt: Date } }) => {
            if (input.where.tokenHash && loseCas) return { count: 0 };
            let count = 0;
            for (const token of draft.tokens) {
              if (
                !token.usedAt &&
                (!input.where.tokenHash || input.where.tokenHash === token.tokenHash)
              ) {
                token.usedAt = input.data.usedAt;
                count++;
              }
            }
            if (!input.where.tokenHash && failure === 'tokens')
              throw new Error('Synthetic token invalidation failure');
            return { count };
          },
        ),
      },
      user: {
        update: vi.fn(async ({ data }: { data: { passwordHash: string } }) => {
          draft.passwordHash = data.passwordHash;
          if (failure === 'password') throw new Error('Synthetic password update failure');
        }),
      },
      authSession: {
        create: vi.fn(async () => {
          draft.createdSessions++;
          return { id: 'created-session' };
        }),
        updateMany: vi.fn(async () => {
          draft.revoked = true;
          if (failure === 'sessions') throw new Error('Synthetic session revocation failure');
          return { count: 1 };
        }),
      },
      authAuditLog: {
        create: vi.fn(async () => {
          draft.audits++;
          if (failure === 'audit') throw new Error('Synthetic audit failure');
        }),
      },
    };
  }
  const client = {
    $transaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) => {
      const draft = structuredClone(state);
      const tx = transaction(draft);
      transactions.push(tx);
      const result = await callback(tx);
      state = draft;
      return result;
    }),
  };
  const store = new PrismaAuthStore(client as unknown as PrismaClient);
  return {
    store,
    client,
    transactions,
    snapshot: () => structuredClone(state),
    failAt: (value: typeof failure) => {
      failure = value;
    },
    loseCas: () => {
      loseCas = true;
    },
    invalidateAtLock: () => {
      invalidateAtLock = true;
    },
    expire: () => {
      state.tokens[0]!.expiresAt = new Date(Date.now());
    },
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Prisma password reset transaction contract (no live database)', () => {
  it('creates a legitimate session under the same account lock', async () => {
    const f = fixture();
    await f.store.createSession({
      id: 'new-session',
      userId: 'test-user',
      familyId: 'test-family',
      refreshTokenHash: 'test-refresh-hash',
      expiresAt: new Date(Date.now() + 60_000),
      expectedPasswordHash: 'old-hash',
    });
    expect(f.snapshot().createdSessions).toBe(1);
    expect(f.transactions[0]!.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it('rejects a stale credential snapshot before creating a post-reset session', async () => {
    const f = fixture();
    await f.store.completePasswordReset({ tokenHash: 'current', passwordHash: 'new-hash' });
    const before = f.snapshot();
    await expect(
      f.store.createSession({
        id: 'stale-session',
        userId: 'test-user',
        familyId: 'test-family',
        refreshTokenHash: 'test-refresh-hash',
        expiresAt: new Date(Date.now() + 60_000),
        expectedPasswordHash: 'old-hash',
      }),
    ).rejects.toThrow('Credentials changed');
    expect(f.snapshot()).toEqual(before);
    expect(f.transactions[1]!.authSession.create).not.toHaveBeenCalled();
  });

  it('runs all writes through one interactive transaction with an account row lock', async () => {
    const f = fixture();
    const result = await f.store.completePasswordReset({
      tokenHash: 'current',
      passwordHash: 'new-hash',
    });
    expect(result.status).toBe('ok');
    expect(f.client.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
    });
    expect(f.client.$transaction).toHaveBeenCalledTimes(1);
    const tx = f.transactions[0]!;
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    const lockArguments = tx.$queryRaw.mock.calls[0] as unknown as [TemplateStringsArray, string];
    expect(lockArguments[0].join('?')).toContain('FOR UPDATE');
    expect(lockArguments[1]).toBe('test-user');
    expect(tx.passwordResetToken.findUnique).toHaveBeenCalledTimes(2);
    expect(tx.passwordResetToken.updateMany).toHaveBeenNthCalledWith(1, {
      where: { tokenHash: 'current', usedAt: null, expiresAt: { gt: expect.any(Date) } },
      data: { usedAt: expect.any(Date) },
    });
    const after = f.snapshot();
    expect(after.passwordHash).toBe('new-hash');
    expect(after.tokens.every((token) => token.usedAt)).toBe(true);
    expect(after.revoked).toBe(true);
    expect(after.audits).toBe(1);
  });

  it.each(['password', 'tokens', 'sessions', 'audit'] as const)(
    'keeps all state unchanged when the transaction fails at %s',
    async (stage) => {
      const f = fixture();
      const before = f.snapshot();
      f.failAt(stage);
      await expect(
        f.store.completePasswordReset({ tokenHash: 'current', passwordHash: 'new-hash' }),
      ).rejects.toThrow('Synthetic');
      expect(f.snapshot()).toEqual(before);
      f.failAt(null);
      expect(
        (await f.store.completePasswordReset({ tokenHash: 'current', passwordHash: 'new-hash' }))
          .status,
      ).toBe('ok');
    },
  );

  it('revalidates the token after waiting for the user lock', async () => {
    const f = fixture();
    f.invalidateAtLock();
    expect(
      (await f.store.completePasswordReset({ tokenHash: 'current', passwordHash: 'new-hash' }))
        .status,
    ).toBe('used');
    expect(f.transactions[0]!.user.update).not.toHaveBeenCalled();
    expect(f.snapshot().passwordHash).toBe('old-hash');
  });

  it('does not update credentials when conditional token consumption loses a race', async () => {
    const f = fixture();
    const before = f.snapshot();
    f.loseCas();
    expect(
      (await f.store.completePasswordReset({ tokenHash: 'current', passwordHash: 'new-hash' }))
        .status,
    ).toBe('used');
    expect(f.snapshot()).toEqual(before);
  });

  it('does not change any state for an expired token at the exact boundary', async () => {
    const f = fixture();
    f.expire();
    const before = f.snapshot();
    expect(
      (await f.store.completePasswordReset({ tokenHash: 'current', passwordHash: 'new-hash' }))
        .status,
    ).toBe('expired');
    expect(f.snapshot()).toEqual(before);
  });

  it('does not acquire an account lock or mutate data for a missing token', async () => {
    const f = fixture();
    const before = f.snapshot();
    expect(
      (await f.store.completePasswordReset({ tokenHash: 'missing', passwordHash: 'new-hash' }))
        .status,
    ).toBe('not_found');
    expect(f.transactions[0]!.$queryRaw).not.toHaveBeenCalled();
    expect(f.snapshot()).toEqual(before);
  });
});
