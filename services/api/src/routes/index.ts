import { Router } from 'express';

export const routes: Router = Router();

routes.get('/health', (_req, res) => res.json({ ok: true }));
