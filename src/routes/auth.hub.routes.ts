import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import rateLimit from 'express-rate-limit';
import { HubUser } from '../types/types';

const router = Router();

const HUB_USERS_JSON = process.env.HUB_USERS_JSON || '[]';
const HUB_SESSION_SECRET = process.env.HUB_SESSION_SECRET || '';
const HUB_COOKIE_NAME = 'hub_session';

function parseUsers(): HubUser[] {
  try {
    const parsed = JSON.parse(HUB_USERS_JSON);
    return Array.isArray(parsed) ? (parsed as HubUser[]) : [];
  } catch {
    return [];
  }
}

function sign(value: string) {
  return crypto.createHmac('sha256', HUB_SESSION_SECRET).update(value).digest('hex');
}

function buildToken(userId: string, expMs: number) {
  const payload = `hub:${userId}:${expMs}`;
  return `${payload}.${sign(payload)}`;
}

function verifyToken(token?: string): { ok: false } | { ok: true; userId: string } {
  if (!token) return { ok: false };

  const [payload, signature] = token.split('.');
  if (!payload || !signature) return { ok: false };
  if (sign(payload) !== signature) return { ok: false };

  const parts = payload.split(':');
  if (parts.length !== 3) return { ok: false };
  if (parts[0] !== 'hub') return { ok: false };

  const userId = parts[1];
  const expMs = Number(parts[2]);
  if (!Number.isFinite(expMs) || Date.now() > expMs) return { ok: false };

  return { ok: true, userId };
}

export function requireHubAuth(req: any, res: any, next: any) {
  const parsed = verifyToken(req.cookies?.[HUB_COOKIE_NAME]);
  if (!parsed.ok) {
    return res.status(401).json({ error: 'Unauthorized', message: 'Not authenticated' });
  }
  req.userId = parsed.userId;
  return next();
}

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too Many Requests',
    message: 'Too many login attempts, please try again later.',
  },
});

router.post('/login', loginLimiter, async (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string };

  if (!email || !password) {
    return res
      .status(400)
      .json({ error: 'Bad Request', message: 'Email and password are required' });
  }

  if (!HUB_SESSION_SECRET) {
    return res.status(500).json({
      error: 'Server Misconfigured',
      message: 'HUB_SESSION_SECRET is missing',
    });
  }

  const users = parseUsers();
  const normalizedEmail = email.trim().toLowerCase();

  const user = users.find((u) => u.email.trim().toLowerCase() === normalizedEmail);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized', message: 'User not found' });
  }

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    return res.status(401).json({ error: 'Unauthorized', message: 'Invalid credentials' });
  }

  const ttlMs = 24 * 60 * 60 * 1000;
  const expMs = Date.now() + ttlMs;
  const token = buildToken(user.id, expMs);

  const isProd = process.env.NODE_ENV === 'production';
  const isHttps = isProd || req.secure || req.headers['x-forwarded-proto'] === 'https';

  res.cookie(HUB_COOKIE_NAME, token, {
    httpOnly: true,
    path: '/',
    maxAge: ttlMs,
    secure: isHttps,
    sameSite: isHttps ? 'none' : 'lax',
  });

  return res.json({
    ok: true,
    user: {
      id: user.id,
      email: user.email,
      photo: user.photo ?? null,
      name: user.name,
      role: user.role ?? null,
    },
  });
});

router.post('/logout', (req, res) => {
  const isProd = process.env.NODE_ENV === 'production';
  const isHttps = isProd || req.secure || req.headers['x-forwarded-proto'] === 'https';

  res.clearCookie(HUB_COOKIE_NAME, {
    path: '/',
    secure: isHttps,
    sameSite: isHttps ? 'none' : 'lax',
  });

  return res.json({ ok: true });
});

router.get('/me', (req, res) => {
  const parsed = verifyToken(req.cookies?.[HUB_COOKIE_NAME]);
  if (!parsed.ok) return res.status(401).json({ ok: false });

  const users = parseUsers();
  const user = users.find((u) => u.id === parsed.userId);

  if (!user) return res.status(401).json({ ok: false });

  return res.json({
    ok: true,
    user: {
      id: user.id,
      email: user.email,
      photo: user.photo ?? null,
      name: user.name,
      role: user.role ?? null,
    },
  });
});

export default router;
