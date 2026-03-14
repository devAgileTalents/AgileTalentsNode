import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { handleRouteError } from '../lib/errors/route-error';
import { getIsHttps } from '../lib/http/cookie';
import { buildAdminToken, verifyAdminToken } from '../lib/auth/admin-session';

const router = Router();

const ADMIN_USERNAME = process.env.ADMIN_USERNAME || '';
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH || '';
const ADMIN_SESSION_SECRET = process.env.ADMIN_SESSION_SECRET || '';
const ADMIN_COOKIE_NAME = 'admin_session';

type AdminLoginBody = {
  login?: string;
  password?: string;
};

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    const token = req.cookies?.[ADMIN_COOKIE_NAME];

    if (!verifyAdminToken(token, ADMIN_SESSION_SECRET)) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Not authenticated',
      });
    }

    return next();
  } catch (error) {
    return handleRouteError(res, 'Admin authentication check', error);
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

router.post('/login', loginLimiter, async (req: Request<{}, {}, AdminLoginBody>, res: Response) => {
  try {
    const { login, password } = req.body;

    if (!login || !password) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Login and password are required',
      });
    }

    if (!ADMIN_SESSION_SECRET) {
      return res.status(500).json({
        error: 'Server Misconfigured',
        message: 'SESSION_SECRET is missing',
      });
    }

    if (!ADMIN_USERNAME || !ADMIN_PASSWORD_HASH) {
      return res.status(500).json({
        error: 'Server Misconfigured',
        message: 'Admin credentials are missing',
      });
    }

    if (login !== ADMIN_USERNAME) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid credentials',
      });
    }

    const ok = await bcrypt.compare(password, ADMIN_PASSWORD_HASH);

    if (!ok) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid credentials',
      });
    }

    const token = buildAdminToken(ADMIN_SESSION_SECRET);
    const isHttps = getIsHttps(req);

    res.cookie(ADMIN_COOKIE_NAME, token, {
      httpOnly: true,
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      secure: isHttps,
      sameSite: isHttps ? 'none' : 'lax',
    });

    return res.json({ ok: true });
  } catch (error) {
    return handleRouteError(res, 'Admin login', error);
  }
});

router.post('/logout', (req: Request, res: Response) => {
  try {
    const isHttps = getIsHttps(req);

    res.clearCookie(ADMIN_COOKIE_NAME, {
      path: '/',
      secure: isHttps,
      sameSite: isHttps ? 'none' : 'lax',
    });

    return res.json({ ok: true });
  } catch (error) {
    return handleRouteError(res, 'Admin logout', error);
  }
});

router.get('/me', (req: Request, res: Response) => {
  try {
    const ok = verifyAdminToken(req.cookies?.[ADMIN_COOKIE_NAME], ADMIN_SESSION_SECRET);
    return res.json({ ok });
  } catch (error) {
    return handleRouteError(res, 'Get admin session', error);
  }
});

export default router;
