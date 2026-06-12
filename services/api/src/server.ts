import express from 'express';
import cors from 'cors';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { errorHandler } from './middleware/error.js';
import { routes } from './routes/index.js';

export function createApp(): express.Express {
  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use('/api', routes);
  app.use(errorHandler);
  return app;
}

export function createHttpServer(app: express.Express): ReturnType<typeof createServer> {
  return createServer(app);
}

export function createIOServer(httpServer: ReturnType<typeof createServer>): Server {
  return new Server(httpServer, { cors: { origin: '*' } });
}
