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
app.use(cookieParser());

/* ───────────────────────────────────────────────
  Security headers
─────────────────────────────────────────────── */
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }),
);

/* ───────────────────────────────────────────────
  Compression
─────────────────────────────────────────────── */
app.use(compression());

/* ───────────────────────────────────────────────
  Static uploads (IMAGES, FILES)
─────────────────────────────────────────────── */
app.use(
  '/uploads',
  express.static(path.join(process.cwd(), 'uploads'), {
    maxAge: '30d',
    immutable: true,
    index: false,
  }),
);

/* ───────────────────────────────────────────────
  Rate limiting
─────────────────────────────────────────────── */
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: {
    error: 'Too Many Requests',
    message: 'Too many requests from this IP, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path === '/health' || req.path.startsWith('/uploads'),
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  message: {
    error: 'Too Many Requests',
    message: 'Too many API requests, please slow down.',
  },
});

const suspiciousLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: {
    error: 'Suspicious Activity Detected',
    message: 'Your request has been blocked due to suspicious activity.',
  },
});

app.use(generalLimiter);

/* ───────────────────────────────────────────────
  CORS
─────────────────────────────────────────────── */
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:3000', 'http://localhost:4000', 'http://217.154.83.75:4000'];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);

      if (process.env.NODE_ENV === 'development') {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      callback(new Error('Not allowed by CORS'));
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    credentials: true,
    maxAge: 86400,
  }),
);

/* ───────────────────────────────────────────────
  Body parsing
─────────────────────────────────────────────── */
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

/* ───────────────────────────────────────────────
  Suspicious activity detection
─────────────────────────────────────────────── */
app.use((req, res, next) => {
  if (req.path.startsWith('/uploads')) return next();
  if (req.path.startsWith('/')) return next();

  const suspiciousPatterns = [
    /\.env/i,
    /\.git/i,
    /wp-config/i,
    /config\.(php|json|yml|yaml)/i,
    /docker-compose/i,
    /\.bak$/i,
    /\.old$/i,
    /\.backup$/i,

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

  const isSuspicious = suspiciousPatterns.some((p) => p.test(req.path));

  if (isSuspicious) {
    console.warn(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️  SUSPICIOUS REQUEST
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Time:   ${new Date().toISOString()}
IP:     ${req.ip}
Method: ${req.method}
Path:   ${req.path}
UA:     ${req.get('user-agent') || 'Unknown'}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    `);

    return suspiciousLimiter(req, res, next);
  }

  next();
});

/* ───────────────────────────────────────────────
  Request logging
─────────────────────────────────────────────── */
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    console.log(`${req.method} ${req.path} → ${res.statusCode} (${Date.now() - start}ms)`);
  });
  next();
});

/* ───────────────────────────────────────────────
  Health check
─────────────────────────────────────────────── */
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

/* ───────────────────────────────────────────────
  API routes
─────────────────────────────────────────────── */
app.use('/', apiLimiter, publicRoutes);

/* ───────────────────────────────────────────────
  404 handler
─────────────────────────────────────────────── */
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found`,
  });
});

/* ───────────────────────────────────────────────
  Error handler
─────────────────────────────────────────────── */
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err.message);

  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'CORS policy does not allow access from your origin',
    });
  }

  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong',
  });
});

export default app;
