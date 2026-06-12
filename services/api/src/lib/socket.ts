import { Server, Socket } from 'socket.io';
import { z } from 'zod';
import { verifyAccessToken } from './jwt.js';
import { prisma } from './prisma.js';

const chatIdEventSchema = z.object({ chatId: z.string().uuid() });
const sendMessageEventSchema = z.object({
  chatId: z.string().uuid(),
  content: z.string().min(1).max(4000),
});
const readMessageEventSchema = z.object({ messageId: z.string().uuid() });

const userSelect = { id: true, email: true, displayName: true, avatarUrl: true };

export function setupSocketHandlers(io: Server) {
  const onlineSockets = new Map<string, Set<string>>();

  io.use((socket: Socket, next) => {
    const token = socket.handshake.auth.token as string | undefined;
    if (!token) return next(new Error('Unauthorized'));
    try {
      const payload = verifyAccessToken(token);
      socket.data.userId = payload.userId;
      return next();
    } catch {
      return next(new Error('Unauthorized'));
    }
  });

  io.on('connection', async (socket) => {
    const userId = socket.data.userId as string;

    socket.join(`user:${userId}`);

    const sockets = onlineSockets.get(userId) ?? new Set<string>();
    const wasOnline = sockets.size > 0;
    sockets.add(socket.id);
    onlineSockets.set(userId, sockets);

    socket.on('chat:join', async (data) => {
      try {
        const { chatId } = chatIdEventSchema.parse(data);
        const member = await prisma.chatMember.findUnique({
          where: { chatId_userId: { chatId, userId } },
        });
        if (!member) {
          return socket.emit('error', { message: 'Not a chat member' });
        }
        socket.join(`chat:${chatId}`);
      } catch (err) {
        socket.emit('error', { message: 'Invalid chat:join payload' });
      }
    });

    socket.on('chat:leave', (data) => {
      try {
        const { chatId } = chatIdEventSchema.parse(data);
        socket.leave(`chat:${chatId}`);
      } catch (err) {
        socket.emit('error', { message: 'Invalid chat:leave payload' });
      }
    });

    socket.on('message:send', async (data) => {
      try {
        const { chatId, content } = sendMessageEventSchema.parse(data);
        const member = await prisma.chatMember.findUnique({
          where: { chatId_userId: { chatId, userId } },
        });
        if (!member) {
          return socket.emit('error', { message: 'Not a chat member' });
        }
        const message = await prisma.message.create({
          data: { chatId, authorId: userId, content, type: 'text' },
          include: {
            author: { select: userSelect },
            readReceipts: { select: { userId: true, readAt: true } },
          },
        });
        await prisma.chat.update({ where: { id: chatId }, data: {} });
        io.to(`chat:${chatId}`).emit('message:new', message);
      } catch (err) {
        socket.emit('error', { message: 'Invalid message:send payload' });
      }
    });

    socket.on('message:read', async (data) => {
      try {
        const { messageId } = readMessageEventSchema.parse(data);
        const message = await prisma.message.findUnique({ where: { id: messageId } });
        if (!message || message.authorId === userId) {
          return socket.emit('error', { message: 'Cannot read this message' });
        }
        const member = await prisma.chatMember.findUnique({
          where: { chatId_userId: { chatId: message.chatId, userId } },
        });
        if (!member) {
          return socket.emit('error', { message: 'Not a chat member' });
        }
        await prisma.readReceipt.upsert({
          where: { messageId_userId: { messageId, userId } },
          create: { messageId, userId },
          update: {},
        });
        io.to(`chat:${message.chatId}`).emit('message:read', {
          messageId,
          userId,
          readAt: new Date().toISOString(),
        });
      } catch (err) {
        socket.emit('error', { message: 'Invalid message:read payload' });
      }
    });

    socket.on('disconnect', async () => {
      const sockets = onlineSockets.get(userId);
      if (sockets) {
        sockets.delete(socket.id);
        if (sockets.size === 0) {
          onlineSockets.delete(userId);
          try {
            await prisma.user.update({ where: { id: userId }, data: { lastSeenAt: new Date() } });
            await broadcastPresence(io, userId, false);
          } catch {
            // ignore
          }
        }
      }
    });

    if (!wasOnline) {
      try {
        await broadcastPresence(io, userId, true);
      } catch (err) {
        socket.emit('error', { message: 'Presence update failed' });
      }
    }
  });
}

async function broadcastPresence(io: Server, userId: string, isOnline: boolean) {
  const contacts = await prisma.contact.findMany({
    where: {
      ownerId: userId,
      status: 'accepted',
    },
    select: { targetId: true },
  });
  const targetIds = contacts.map((c) => c.targetId);

  const reverseContacts = await prisma.contact.findMany({
    where: {
      targetId: userId,
      status: 'accepted',
    },
    select: { ownerId: true },
  });
  const ownerIds = reverseContacts.map((c) => c.ownerId);

  const contactIds = Array.from(new Set([...targetIds, ...ownerIds]));
  const payload = isOnline
    ? { userId, isOnline: true }
    : { userId, isOnline: false, lastSeenAt: new Date().toISOString() };

  for (const contactId of contactIds) {
    io.to(`user:${contactId}`).emit('user:presence', payload);
  }
}
