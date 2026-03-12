import { Response } from 'express';

export function handleRouteError(res: Response, context: string, error: unknown) {
  console.error(`${context} error:`, error);

  return res.status(500).json({
    error: 'Internal Server Error',
    message: `${context} failed`,
  });
}
