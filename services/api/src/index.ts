import { config } from './config.js';
import { createApp, createHttpServer, createIOServer } from './server.js';
import { setupSocketHandlers } from './lib/socket.js';
import { prisma } from './lib/prisma.js';
import { closeRedis } from './lib/redis.js';

const app = createApp();
const httpServer = createHttpServer(app);
const io = createIOServer(httpServer);

async function shutdown(signal: string) {
  console.log(`Received ${signal}, shutting down gracefully...`);
  httpServer.close(() => console.log('HTTP server closed'));
  io.close(() => console.log('Socket.io server closed'));
  await prisma.$disconnect();
  await closeRedis();
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

async function main() {
  setupSocketHandlers(io);

  httpServer.listen(config.port, () => {
    console.log(`API server listening on http://localhost:${config.port}`);
  });
}

main().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
