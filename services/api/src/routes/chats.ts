import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { ApiError } from '../middleware/error.js';

const createGroupSchema = z.object({
  title: z.string().min(1),
  memberIds: z.array(z.string().uuid()).min(1),
});

const sendMessageSchema = z.object({
  content: z.string().min(1).max(4000),
});

const userSelect = { id: true, email: true, displayName: true, avatarUrl: true };

export const chatsRouter: Router = Router();

chatsRouter.use(requireAuth);

chatsRouter.get('/', async (req: AuthRequest, res, next) => {
  try {
    const chats = await prisma.chat.findMany({
      where: { members: { some: { userId: req.user!.userId } } },
      include: {
        members: { include: { user: { select: userSelect } } },
        messages: { orderBy: { createdAt: 'desc' }, take: 1, include: { author: { select: userSelect } } },
      },
      orderBy: { updatedAt: 'desc' },
    });
    res.json(chats);
  } catch (err) {
    next(err);
  }
});

chatsRouter.post('/', async (req: AuthRequest, res, next) => {
  try {
    const { title, memberIds } = createGroupSchema.parse(req.body);

    const existingUsers = await prisma.user.findMany({
      where: { id: { in: memberIds } },
      select: { id: true },
    });
    if (existingUsers.length !== memberIds.length) {
      throw new ApiError(400, 'One or more members do not exist');
    }

    const allMembers = Array.from(new Set([req.user!.userId, ...memberIds]));
    const chat = await prisma.chat.create({
      data: {
        type: 'group',
        title,
        members: { create: allMembers.map((userId, idx) => ({ userId, role: idx === 0 ? 'owner' : 'member' })) },
      },
      include: { members: { include: { user: { select: userSelect } } } },
    });
    res.status(201).json(chat);
  } catch (err) {
    next(err);
  }
});

chatsRouter.get('/:id/messages', async (req: AuthRequest, res, next) => {
  try {
    const id = z.string().uuid().parse(req.params.id);
    await assertChatMember(id, req.user!.userId);
    const rawMessages = await prisma.message.findMany({
      where: { chatId: id },
      include: {
        author: { select: userSelect },
        readReceipts: { select: { userId: true, readAt: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    const messages = rawMessages.reverse().map((message) => {
      const { readReceipts, ...rest } = message;
      return { ...rest, readBy: readReceipts.map((r) => ({ userId: r.userId, readAt: r.readAt.toISOString() })) };
    });
    res.json(messages);
  } catch (err) {
    next(err);
  }
});

chatsRouter.post('/:id/messages', async (req: AuthRequest, res, next) => {
  try {
    const id = z.string().uuid().parse(req.params.id);
    const { content } = sendMessageSchema.parse(req.body);
    await assertChatMember(id, req.user!.userId);
    const rawMessage = await prisma.message.create({
      data: { chatId: id, authorId: req.user!.userId, content, type: 'text' },
      include: {
        author: { select: userSelect },
        readReceipts: { select: { userId: true, readAt: true } },
      },
    });
    await prisma.chat.update({ where: { id }, data: {} });
    const { readReceipts, ...rest } = rawMessage;
    const message = { ...rest, readBy: readReceipts.map((r) => ({ userId: r.userId, readAt: r.readAt.toISOString() })) };
    res.status(201).json(message);
  } catch (err) {
    next(err);
  }
});

chatsRouter.post('/messages/:messageId/read', async (req: AuthRequest, res, next) => {
  try {
    const messageId = z.string().uuid().parse(req.params.messageId);
    const message = await prisma.message.findUnique({ where: { id: messageId } });
    if (!message) throw new ApiError(404, 'Message not found');
    if (message.authorId === req.user!.userId) throw new ApiError(400, 'Cannot read own message');
    await assertChatMember(message.chatId, req.user!.userId);
    await prisma.readReceipt.upsert({
      where: { messageId_userId: { messageId, userId: req.user!.userId } },
      create: { messageId, userId: req.user!.userId },
      update: {},
    });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

async function assertChatMember(chatId: string, userId: string) {
  const member = await prisma.chatMember.findUnique({
    where: { chatId_userId: { chatId, userId } },
  });
  if (!member) throw new ApiError(403, 'Not a chat member');
}
