import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { HubUser } from '../types/types';
import { handleRouteError } from '../lib/errors/route-error';
import { getIsHttps } from '../lib/http/cookie';
import { buildHubToken, verifyHubToken } from '../lib/auth/hub-session';

const router = Router();

const HUB_USERS_JSON = process.env.HUB_USERS_JSON || '[]';
const HUB_SESSION_SECRET = process.env.HUB_SESSION_SECRET || '';
const HUB_COOKIE_NAME = 'hub_session';

type LoginBody = {
  email?: string;
  password?: string;
};

function parseUsers(): HubUser[] {
  try {
    const parsed = JSON.parse(HUB_USERS_JSON);
    return Array.isArray(parsed) ? (parsed as HubUser[]) : [];
  } catch (error) {
    console.error('parseUsers error:', error);
    return [];
  }
}

function getPublicHubUser(user: HubUser) {
  return {
    id: user.id,
    email: user.email,
    photo: user.photo ?? null,
    name: user.name,
    role: user.role ?? null,
  };
}

export function requireHubAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = verifyHubToken(req.cookies?.[HUB_COOKIE_NAME], HUB_SESSION_SECRET);

    if (!parsed.ok) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Not authenticated',
      });
    }

    req.userId = parsed.userId;
    return next();
  } catch (error) {
    return handleRouteError(res, 'Authentication check', error);
  }
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

router.post('/login', loginLimiter, async (req: Request<{}, {}, LoginBody>, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Email and password are required',
      });
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
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'User not found',
      });
    }

    const ok = await bcrypt.compare(password, user.passwordHash);

    if (!ok) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid credentials',
      });
    }

    const ttlMs = 24 * 60 * 60 * 1000;
    const expMs = Date.now() + ttlMs;
    const token = buildHubToken(user.id, expMs, HUB_SESSION_SECRET);
    const isHttps = getIsHttps(req);

    res.cookie(HUB_COOKIE_NAME, token, {
      httpOnly: true,
      path: '/',
      maxAge: ttlMs,
      secure: isHttps,
      sameSite: isHttps ? 'none' : 'lax',
    });

    return res.json({
      ok: true,
      user: getPublicHubUser(user),
    });
  } catch (error) {
    return handleRouteError(res, 'Login', error);
  }
});

router.post('/logout', (req: Request, res: Response) => {
  try {
    const isHttps = getIsHttps(req);

    res.clearCookie(HUB_COOKIE_NAME, {
      path: '/',
      secure: isHttps,
      sameSite: isHttps ? 'none' : 'lax',
    });

    return res.json({ ok: true });
  } catch (error) {
    return handleRouteError(res, 'Logout', error);
  }
});

router.get('/me', (req: Request, res: Response) => {
  try {
    const parsed = verifyHubToken(req.cookies?.[HUB_COOKIE_NAME], HUB_SESSION_SECRET);

    if (!parsed.ok) {
      return res.status(401).json({ ok: false });
    }

    const users = parseUsers();
    const user = users.find((u) => u.id === parsed.userId);

    if (!user) {
      return res.status(401).json({ ok: false });
    }

    return res.json({
      ok: true,
      user: getPublicHubUser(user),
    });
  } catch (error) {
    return handleRouteError(res, 'Get current user', error);
  }
});

export default router;
