import { config } from './config.js';
import { createApp, createHttpServer, createIOServer } from './server.js';
import { setupSocketHandlers } from './lib/socket.js';

async function main() {
  const app = createApp();
  const httpServer = createHttpServer(app);
  const io = createIOServer(httpServer);
  setupSocketHandlers(io);

  httpServer.listen(config.port, () => {
    console.log(`API server listening on http://localhost:${config.port}`);
  });
}

main();
