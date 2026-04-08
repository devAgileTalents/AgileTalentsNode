import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { handleRouteError } from '../lib/errors/route-error';
import { getIsHttps } from '../lib/http/cookie';
import { buildHubToken, verifyHubToken } from '../lib/auth/hub-session';
import { pool } from '../db/index';
import { HubUserDB } from '../types/db.types';

const router = Router();

const HUB_SESSION_SECRET = process.env.HUB_SESSION_SECRET || '';
const HUB_COOKIE_NAME = 'hub_session';

type LoginBody = {
  email?: string;
  password?: string;
};

function getPublicHubUser(user: HubUserDB) {
  return {
    id: String(user.id),
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

    const normalizedEmail = email.trim().toLowerCase();

    const result = await pool.query<HubUserDB>(
      'SELECT * FROM hub_users WHERE LOWER(email) = $1 LIMIT 1',
      [normalizedEmail],
    );

    const user = result.rows[0];

    if (!user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'User not found',
      });
    }

    if (!user.password_hash) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Password not set for this user',
      });
    }

    const ok = await bcrypt.compare(password, user.password_hash);

    if (!ok) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid credentials',
      });
    }

    const ttlMs = 24 * 60 * 60 * 1000;
    const expMs = Date.now() + ttlMs;
    const token = buildHubToken(String(user.id), expMs, HUB_SESSION_SECRET);
    const isHttps = getIsHttps(req);

    // On login: update last_seen, and activate Invited users
    const newStatus = user.status === 'Invited' ? 'Active' : user.status;
    await pool.query(
      'UPDATE hub_users SET last_seen = NOW(), status = $1 WHERE id = $2',
      [newStatus, user.id],
    );

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

router.get('/me', async (req: Request, res: Response) => {
  try {
    const parsed = verifyHubToken(req.cookies?.[HUB_COOKIE_NAME], HUB_SESSION_SECRET);

    if (!parsed.ok) {
      return res.status(401).json({ ok: false });
    }

    const userId = Number(parsed.userId);

    // Refresh last_seen on every /me call.
    // If status is Active or Last been — set Active (user is online now).
    // Admin-set statuses (Invited, Disabled, Archived) are not changed.
    await pool.query(
      `UPDATE hub_users
       SET last_seen = NOW(),
           status = CASE
             WHEN status IN ('Active', 'Last been') THEN 'Active'
             ELSE status
           END
       WHERE id = $1`,
      [userId],
    );

    const result = await pool.query<HubUserDB>(
      'SELECT * FROM hub_users WHERE id = $1 LIMIT 1',
      [userId],
    );

    const user = result.rows[0];

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
