import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import rateLimit from 'express-rate-limit';

const router = Router();

const ADMIN_USERNAME = process.env.ADMIN_USERNAME || '';
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH || '';
const ADMIN_SESSION_SECRET = process.env.SESSION_SECRET || '';

function sign(value: string) {
  return crypto.createHmac('sha256', ADMIN_SESSION_SECRET).update(value).digest('hex');
}

function buildToken() {
  const payload = `admin:${Date.now()}`;
  return `${payload}.${sign(payload)}`;
}

function verifyToken(token?: string) {
  if (!token) return false;
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return false;
  return sign(payload) === signature;
}

export function requireAdmin(req: any, res: any, next: any) {
  const token = req.cookies?.admin_session;
  if (!verifyToken(token)) {
    return res.status(401).json({ error: 'Unauthorized', message: 'Not authenticated' });
  }
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
  const { login, password } = req.body as { login?: string; password?: string };

  if (!login || !password) {
    return res
      .status(400)
      .json({ error: 'Bad Request', message: 'Login and password are required' });
  }

  if (login !== ADMIN_USERNAME) {
    return res.status(401).json({ error: 'Unauthorized', message: 'Invalid credentials' });
  }

  const ok = await bcrypt.compare(password, ADMIN_PASSWORD_HASH);
  if (!ok) {
    return res.status(401).json({ error: 'Unauthorized', message: 'Invalid credentials' });
  }

  const token = buildToken();

  const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';

  res.cookie('admin_session', token, {
    httpOnly: true,
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000,

    secure: isHttps,
    sameSite: isHttps ? 'none' : 'lax',
  });

  return res.json({ ok: true });
});

router.post('/logout', (req, res) => {
  const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';

  res.clearCookie('admin_session', {
    path: '/',
    secure: isHttps,
    sameSite: isHttps ? 'none' : 'lax',
  });
  return res.json({ ok: true });
});

router.get('/me', (req, res) => {
  const ok = verifyToken(req.cookies?.admin_session);
  return res.json({ ok });
});

export default router;
