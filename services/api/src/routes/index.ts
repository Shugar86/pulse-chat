import { Router } from 'express';
import { authRouter } from './auth.js';

export const routes: Router = Router();

routes.get('/health', (_req, res) => res.json({ ok: true }));
routes.use('/auth', authRouter);
