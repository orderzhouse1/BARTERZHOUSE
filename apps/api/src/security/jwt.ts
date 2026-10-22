import { randomUUID } from 'node:crypto';

import { SignJWT, jwtVerify } from 'jose';

import { getEnv } from '../config/index.js';

export type TokenType = 'access' | 'refresh';
export type JwtRole = 'USER' | 'SUPER_ADMIN';

export interface SignTokenParams {
  userId: string;
  sessionId: string;
  role: JwtRole;
}

export interface SignedToken {
  token: string;
  jti: string;
  expiresAt: Date;
}

export interface VerifiedTokenPayload {
  sub: string;
  sid: string;
  role: JwtRole;
  jti: string;
  type: TokenType;
}

function secretKey(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

async function signToken(
  type: TokenType,
  params: SignTokenParams,
  ttlMs: number,
  secret: string,
): Promise<SignedToken> {
  const env = getEnv();
  const jti = randomUUID();
  const expiresAt = new Date(Date.now() + ttlMs);

  const token = await new SignJWT({ sid: params.sessionId, role: params.role, type })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(params.userId)
    .setIssuer(env.JWT_ISSUER)
    .setAudience(env.JWT_AUDIENCE)
    .setJti(jti)
    .setIssuedAt()
    .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
    .sign(secretKey(secret));

  return { token, jti, expiresAt };
}

export async function signAccessToken(params: SignTokenParams): Promise<SignedToken> {
  const env = getEnv();
  return signToken('access', params, env.JWT_ACCESS_TTL_MINUTES * 60_000, env.JWT_ACCESS_SECRET);
}

export async function signRefreshToken(params: SignTokenParams): Promise<SignedToken> {
  const env = getEnv();
  return signToken(
    'refresh',
    params,
    env.JWT_REFRESH_TTL_DAYS * 86_400_000,
    env.JWT_REFRESH_SECRET,
  );
}

async function verifyToken(
  token: string,
  expectedType: TokenType,
  secret: string,
): Promise<VerifiedTokenPayload> {
  const env = getEnv();

  const { payload } = await jwtVerify(token, secretKey(secret), {
    issuer: env.JWT_ISSUER,
    audience: env.JWT_AUDIENCE,
  });

  if (payload.type !== expectedType) {
    throw new Error(`Unexpected token type: expected ${expectedType}.`);
  }

  if (
    typeof payload.sub !== 'string' ||
    typeof payload.sid !== 'string' ||
    typeof payload.jti !== 'string'
  ) {
    throw new Error('Malformed token payload.');
  }

  const role = payload.role;
  if (role !== 'USER' && role !== 'SUPER_ADMIN') {
    throw new Error('Malformed token role claim.');
  }

  return { sub: payload.sub, sid: payload.sid, role, jti: payload.jti, type: expectedType };
}

export async function verifyAccessToken(token: string): Promise<VerifiedTokenPayload> {
  return verifyToken(token, 'access', getEnv().JWT_ACCESS_SECRET);
}

export async function verifyRefreshToken(token: string): Promise<VerifiedTokenPayload> {
  return verifyToken(token, 'refresh', getEnv().JWT_REFRESH_SECRET);
}
