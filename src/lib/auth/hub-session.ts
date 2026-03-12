import { buildSignedToken, verifySignedToken } from './signed-token';

export function buildHubToken(userId: string, expMs: number, secret: string): string {
  const payload = `hub:${userId}:${expMs}`;
  return buildSignedToken(payload, secret);
}

export function verifyHubToken(
  token: string | undefined,
  secret: string,
): { ok: false } | { ok: true; userId: string } {
  const verified = verifySignedToken(token, secret);

  if (!verified.ok) {
    return { ok: false };
  }

  const parts = verified.payload.split(':');

  if (parts.length !== 3) return { ok: false };
  if (parts[0] !== 'hub') return { ok: false };

  const userId = parts[1];
  const expMs = Number(parts[2]);

  if (!Number.isFinite(expMs) || Date.now() > expMs) {
    return { ok: false };
  }

  return { ok: true, userId };
}
