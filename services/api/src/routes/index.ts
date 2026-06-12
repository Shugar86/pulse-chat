import { Router } from 'express';
import { authRouter } from './auth.js';
import { usersRouter } from './users.js';
import { contactsRouter } from './contacts.js';
import { chatsRouter } from './chats.js';

export const routes: Router = Router();

routes.get('/health', (_req, res) => res.json({ ok: true }));
routes.use('/auth', authRouter);
routes.use('/users', usersRouter);
routes.use('/contacts', contactsRouter);
routes.use('/chats', chatsRouter);
