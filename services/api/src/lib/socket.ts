import { Server, Socket } from 'socket.io';
import { verifyAccessToken } from './jwt.js';
import { prisma } from './prisma.js';

export function setupSocketHandlers(io: Server) {
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
    await prisma.user.update({ where: { id: userId }, data: { lastSeenAt: new Date() } });
    socket.broadcast.emit('user:presence', { userId, isOnline: true });

    socket.on('chat:join', async ({ chatId }: { chatId: string }) => {
      const member = await prisma.chatMember.findUnique({
        where: { chatId_userId: { chatId, userId } },
      });
      if (member) socket.join(`chat:${chatId}`);
    });

    socket.on('chat:leave', ({ chatId }: { chatId: string }) => {
      socket.leave(`chat:${chatId}`);
    });

    socket.on('message:send', async ({ chatId, content }: { chatId: string; content: string }) => {
      const member = await prisma.chatMember.findUnique({
        where: { chatId_userId: { chatId, userId } },
      });
      if (!member) return;
      const message = await prisma.message.create({
        data: { chatId, authorId: userId, content, type: 'text' },
        include: {
          author: { select: { id: true, email: true, displayName: true, avatarUrl: true } },
          readReceipts: { select: { userId: true, readAt: true } },
        },
      });
      await prisma.chat.update({ where: { id: chatId }, data: {} });
      io.to(`chat:${chatId}`).emit('message:new', message);
    });

    socket.on('message:read', async ({ messageId }: { messageId: string }) => {
      const message = await prisma.message.findUnique({ where: { id: messageId } });
      if (!message || message.authorId === userId) return;
      const member = await prisma.chatMember.findUnique({
        where: { chatId_userId: { chatId: message.chatId, userId } },
      });
      if (!member) return;
      await prisma.readReceipt.upsert({
        where: { messageId_userId: { messageId, userId } },
        create: { messageId, userId },
        update: {},
      });
      io.to(`chat:${message.chatId}`).emit('message:read', { messageId, userId, readAt: new Date().toISOString() });
    });

    socket.on('disconnect', () => {
      socket.broadcast.emit('user:presence', { userId, isOnline: false, lastSeenAt: new Date().toISOString() });
    });
  });
}
