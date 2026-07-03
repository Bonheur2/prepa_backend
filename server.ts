import './env';
import app from './app';
import pool from './Config/db';

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

const server = app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

function shutdown(signal: string) {
  console.log(`${signal} received, shutting down...`);
  server.close(() => {
    pool.end().then(() => process.exit(0), () => process.exit(1));
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
