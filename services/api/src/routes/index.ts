import { Router } from 'express';
import { authRouter } from './auth.js';
import { usersRouter } from './users.js';
import { tenantsRouter } from './tenants.js';
import { contactsRouter } from './contacts.js';
import { chatsRouter } from './chats.js';
import { vpnRouter } from './vpn.js';
import { healthRouter } from './health.js';

export const routes: Router = Router();

routes.use('/health', healthRouter);
routes.use('/auth', authRouter);
routes.use('/users', usersRouter);
routes.use('/tenants', tenantsRouter);
routes.use('/contacts', contactsRouter);
routes.use('/chats', chatsRouter);
routes.use('/vpn', vpnRouter);
