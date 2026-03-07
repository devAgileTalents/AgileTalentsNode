import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

import app from './app';
import { pool } from './db/index';

const PORT = parseInt(process.env.PORT || '4000', 10);
const HOST = process.env.HOST || '0.0.0.0';
const NODE_ENV = process.env.NODE_ENV || 'development';

const startServer = async () => {
  try {
    // Checking the connection to the database
    const res = await pool.query('SELECT NOW()');
    console.log('✅ PostgreSQL connected:', res.rows[0]);

    // Start the server ONLY if the database is available
    const server = app.listen(PORT, HOST, () => {
      console.log('═══════════════════════════════════════════════════════');
      console.log(`🚀 Server running in ${NODE_ENV} mode`);
      console.log(`📡 Local:    http://localhost:${PORT}`);
      console.log(`🔗 API:      http://217.154.83.75:${PORT}/api`);
      console.log(`❤️  Health:  http://217.154.83.75:${PORT}/health`);
      console.log('═══════════════════════════════════════════════════════');
    });

    // Graceful shutdown
    const gracefulShutdown = (signal: string) => {
      console.log(`\n${signal} received. Shutting down...`);

      server.close(async () => {
        console.log('HTTP server closed');
        await pool.end();
        process.exit(0);
      });

      setTimeout(() => process.exit(1), 10000);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  } catch (error) {
    console.error('❌ Failed to connect to PostgreSQL');
    console.error(error);
    process.exit(1);
  }
};

startServer();
