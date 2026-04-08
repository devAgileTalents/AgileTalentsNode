import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import path from 'path';
import publicRoutes from './routes/public.routes';
import cookieParser from 'cookie-parser';

const app = express();

app.set('trust proxy', 1);

/* ───────────────────────────────────────────────
  Constants
─────────────────────────────────────────────── */
const IS_DEV = process.env.NODE_ENV === 'development';

const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:3000', 'http://localhost:4000', 'http://217.154.83.75:4000'];

const SUSPICIOUS_PATTERNS = [
  /\.env/i,
  /\.git/i,
  /wp-config/i,
  /config\.(php|json|yml|yaml)/i,
  /docker-compose/i,
  /\.bak$|\.old$|\.backup$/i,
  /\.\.\//,
  /%2e%2e/i,
  /%252e%252e/i,
  /@fs\//i,
  /proc\/self/i,
  /etc\/passwd/i,
  /actuator\//i,
  /\.well-known\/security/i,
  /HNAP1/i,
  /evox\//i,
  /phpMyAdmin/i,
  /phpmyadmin/i,
  /admin/i,
  /console/i,
];

/* ───────────────────────────────────────────────
  Rate limiters
─────────────────────────────────────────────── */
const DEV_IPS = process.env.DEV_IPS || '';

function normalizeIp(ip?: string) {
  if (!ip) return '';
  return ip.replace('::ffff:', '').trim();
}

function isDevIp(req: express.Request) {
  const ip = normalizeIp(req.ip);
  return DEV_IPS.includes(ip);
}

function shouldSkipRateLimit(req: express.Request) {
  // Allow disabling rate limiting entirely via env (for development)
  if (process.env.DISABLE_RATE_LIMIT === 'true') return true;

  // Hub routes are protected by requireHubAuth (cookie auth).
  // nginx may strip /hub prefix, so check multiple path patterns.
  if (req.path.startsWith('/hub/')) return true;
  if (req.path.startsWith('/auth/') || req.path.startsWith('/data/')) return true;

  // Hub proxy sets this header
  if (req.get('x-forwarded-host') === 'api.agiletalents.io') return true;

  // Authenticated hub user
  if (req.cookies?.hub_session) return true;

  // Dev whitelist
  if (isDevIp(req)) return true;

  // Local server-to-server
  const ip = normalizeIp(req.ip);
  if (['127.0.0.1', '::1', 'localhost'].includes(ip)) return true;

  return false;
}

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) =>
    req.path === '/health' || req.path.startsWith('/uploads') || shouldSkipRateLimit(req),
  message: {
    error: 'Too Many Requests',
    message: 'Too many requests from this IP, please try again later.',
  },
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  skip: (req) => shouldSkipRateLimit(req),
  message: {
    error: 'Too Many Requests',
    message: 'Too many API requests, please slow down.',
  },
});

const suspiciousLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  skip: (req) => shouldSkipRateLimit(req),
  message: {
    error: 'Suspicious Activity Detected',
    message: 'Your request has been blocked due to suspicious activity.',
  },
});

/* ───────────────────────────────────────────────
  Domain guard middlewares
─────────────────────────────────────────────── */
const onlyMediaDomain = (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
) => {
  if (req.hostname !== 'media.agiletalents.io') {
    return res
      .status(403)
      .json({ error: 'Forbidden', message: 'Media is not available on this domain' });
  }
  next();
};

const onlyApiDomain = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (req.hostname !== 'api.agiletalents.io') {
    return res
      .status(403)
      .json({ error: 'Forbidden', message: 'API is not available on this domain' });
  }
  next();
};

/* ───────────────────────────────────────────────
  Suspicious activity detection
─────────────────────────────────────────────── */
const suspiciousDetector = (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
) => {
  if (req.path.startsWith('/uploads') || req.path.startsWith('/')) return next();

  if (SUSPICIOUS_PATTERNS.some((p) => p.test(req.path))) {
    console.warn(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️  SUSPICIOUS REQUEST
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Time:   ${new Date().toISOString()}
IP:     ${req.ip}
Method: ${req.method}
Path:   ${req.path}
UA:     ${req.get('user-agent') || 'Unknown'}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    return suspiciousLimiter(req, res, next);
  }

  next();
};

/* ───────────────────────────────────────────────
  Request logging
─────────────────────────────────────────────── */
const requestLogger = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const start = Date.now();
  res.on('finish', () => {
    console.log(`${req.method} ${req.path} → ${res.statusCode} (${Date.now() - start}ms)`);
  });
  next();
};

/* ───────────────────────────────────────────────
  App setup
─────────────────────────────────────────────── */
app.use(cookieParser());
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(compression());
app.use(generalLimiter);
app.use(suspiciousDetector);
app.use(requestLogger);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || IS_DEV || ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
      callback(new Error('Not allowed by CORS'));
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    credentials: true,
    maxAge: 86400,
  }),
);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

/* ───────────────────────────────────────────────
  Routes
─────────────────────────────────────────────── */
app.use(
  '/uploads',
  onlyMediaDomain,
  express.static(path.join(process.cwd(), 'uploads'), {
    maxAge: '30d',
    immutable: true,
    index: false,
  }),
);

app.get('/health', (req, res) => {
  res
    .status(200)
    .json({ status: 'OK', uptime: process.uptime(), timestamp: new Date().toISOString() });
});

app.use('/', onlyApiDomain, apiLimiter, publicRoutes);

/* ───────────────────────────────────────────────
  Error handlers
─────────────────────────────────────────────── */
app.use((req, res) => {
  res
    .status(404)
    .json({ error: 'Not Found', message: `Route ${req.method} ${req.path} not found` });
});

app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err.message);

  if (err.message === 'Not allowed by CORS') {
    return res
      .status(403)
      .json({ error: 'Forbidden', message: 'CORS policy does not allow access from your origin' });
  }

  res.status(500).json({
    error: 'Internal Server Error',
    message: IS_DEV ? err.message : 'Something went wrong',
  });
});

export default app;
