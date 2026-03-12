import { buildSignedToken, verifySignedToken } from './signed-token';

export function buildAdminToken(secret: string): string {
  const payload = `admin:${Date.now()}`;
  return buildSignedToken(payload, secret);
}

export function verifyAdminToken(token: string | undefined, secret: string): boolean {
  const verified = verifySignedToken(token, secret);

  if (!verified.ok) {
    return false;
  }

  const parts = verified.payload.split(':');

  if (parts.length !== 2) return false;
  if (parts[0] !== 'admin') return false;

  return true;
}
