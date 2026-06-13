import express from 'express';
import cors from 'cors';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { config } from './config.js';
import { errorHandler } from './middleware/error.js';
import { requestLogger } from './middleware/requestLogger.js';
import { securityHeaders } from './middleware/security.js';
import { routes } from './routes/index.js';

export function createApp(): express.Express {
  const app = express();
  app.use(securityHeaders);
  app.use(cors({ origin: config.corsOrigin }));
  app.use(express.json({ limit: '32kb' }));
  app.use(requestLogger);
  app.use('/api', routes);
  app.use(errorHandler);
  return app;
}

export function createHttpServer(app: express.Express): ReturnType<typeof createServer> {
  return createServer(app);
}

export function createIOServer(httpServer: ReturnType<typeof createServer>): Server {
  return new Server(httpServer, { cors: { origin: config.corsOrigin } });
}
