import { Router } from 'express';
import { authRouter } from './auth.js';
import { usersRouter } from './users.js';
import { tenantsRouter } from './tenants.js';
import { contactsRouter } from './contacts.js';
import { chatsRouter } from './chats.js';
import { vpnRouter } from './vpn.js';

export const routes: Router = Router();

routes.get('/health', (_req, res) => res.json({ ok: true }));
routes.use('/auth', authRouter);
routes.use('/users', usersRouter);
routes.use('/tenants', tenantsRouter);
routes.use('/contacts', contactsRouter);
routes.use('/chats', chatsRouter);
routes.use('/vpn', vpnRouter);
