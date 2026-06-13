import { Router } from 'express';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { generateTurnCredentials } from '../lib/turn.js';

export const turnRouter: Router = Router();

turnRouter.use(requireAuth);

turnRouter.get('/credentials', (req: AuthRequest, res) => {
  const creds = generateTurnCredentials(req.user!.userId);
  res.json({
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      {
        urls: creds.urls[0],
        username: creds.username,
        credential: creds.credential,
      },
    ],
  });
});
