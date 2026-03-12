import { Request } from 'express';

export function getIsHttps(req: Request): boolean {
  const isProd = process.env.NODE_ENV === 'production';
  return isProd || req.secure || req.headers['x-forwarded-proto'] === 'https';
}
