import crypto from 'crypto';

export function signValue(value: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(value).digest('hex');
}

export function buildSignedToken(payload: string, secret: string): string {
  return `${payload}.${signValue(payload, secret)}`;
}

export function verifySignedToken(
  token: string | undefined,
  secret: string,
): { ok: false } | { ok: true; payload: string } {
  try {
    if (!token) return { ok: false };

    const [payload, signature] = token.split('.');
    if (!payload || !signature) return { ok: false };

    if (signValue(payload, secret) !== signature) {
      return { ok: false };
    }

    return { ok: true, payload };
  } catch (error) {
    console.error('verifySignedToken error:', error);
    return { ok: false };
  }
}
