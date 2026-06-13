import { Server, Socket } from 'socket.io';
import { z } from 'zod';
import { verifyAccessToken } from './jwt.js';
import { prisma } from './prisma.js';
import {
  createCallSession,
  getCallSession,
  connectCallSession,
  endCallSession,
  getActiveCallId,
} from './calls.js';

const chatIdEventSchema = z.object({ chatId: z.string().uuid() });
const sendMessageEventSchema = z.object({
  chatId: z.string().uuid(),
  content: z.string().min(1).max(4000),
});
const readMessageEventSchema = z.object({ messageId: z.string().uuid() });

const offerSchema = z.object({ callId: z.string().uuid(), toUserId: z.string().uuid(), sdp: z.string().min(1) });
const answerSchema = z.object({ callId: z.string().uuid(), sdp: z.string().min(1) });
const iceCandidateSchema = z.object({ callId: z.string().uuid(), candidate: z.record(z.any()) });
const callIdSchema = z.object({ callId: z.string().uuid() });

const CALL_TIMEOUT_MS = 30000;

const userSelect = { id: true, email: true, displayName: true, avatarUrl: true };

function formatMessage(message: {
  id: string;
  chatId: string;
  authorId: string;
  type: string;
  content: string;
  createdAt: Date;
  editedAt: Date | null;
  author: { id: string; email: string; displayName: string; avatarUrl: string | null };
  readReceipts: { userId: string; readAt: Date }[];
}) {
  const { readReceipts, ...rest } = message;
  return { ...rest, readBy: readReceipts.map((r) => ({ userId: r.userId, readAt: r.readAt.toISOString() })) };
}

function setupCallHandlers(io: Server, socket: Socket, userId: string) {
  socket.on('call:offer', async (data) => {
    try {
      const { callId, toUserId, sdp } = offerSchema.parse(data);
      if (toUserId === userId) return socket.emit('error', { message: 'Cannot call yourself' });
      const session = createCallSession(callId, userId, toUserId);
      if (!session) return socket.emit('call:busy', { callId, toUserId });

      io.to(`user:${toUserId}`).emit('call:incoming', { callId, fromUserId: userId, sdp });

      setTimeout(() => {
        const s = getCallSession(callId);
        if (s && s.status === 'dialing') {
          endCallSession(callId);
          io.to(`user:${s.callerId}`).emit('call:timeout', { callId });
          io.to(`user:${s.calleeId}`).emit('call:timeout', { callId });
        }
      }, CALL_TIMEOUT_MS);
    } catch {
      socket.emit('error', { message: 'Invalid call:offer payload' });
    }
  });

  socket.on('call:answer', (data) => {
    try {
      const { callId, sdp } = answerSchema.parse(data);
      const session = getCallSession(callId);
      if (!session || session.calleeId !== userId) return socket.emit('error', { message: 'Call not found' });
      if (!connectCallSession(callId)) return socket.emit('error', { message: 'Call not in dialing state' });
      io.to(`user:${session.callerId}`).emit('call:answer', { callId, sdp });
    } catch {
      socket.emit('error', { message: 'Invalid call:answer payload' });
    }
  });

  socket.on('call:ice-candidate', (data) => {
    try {
      const { callId, candidate } = iceCandidateSchema.parse(data);
      const session = getCallSession(callId);
      if (!session || (session.callerId !== userId && session.calleeId !== userId)) {
        return socket.emit('error', { message: 'Call not found' });
      }
      const toUserId = session.callerId === userId ? session.calleeId : session.callerId;
      io.to(`user:${toUserId}`).emit('call:ice-candidate', { callId, candidate });
    } catch {
      socket.emit('error', { message: 'Invalid call:ice-candidate payload' });
    }
  });

  socket.on('call:hangup', (data) => {
    try {
      const { callId } = callIdSchema.parse(data);
      const session = getCallSession(callId);
      if (!session || (session.callerId !== userId && session.calleeId !== userId)) {
        return socket.emit('error', { message: 'Call not found' });
      }
      endCallSession(callId);
      const otherUserId = session.callerId === userId ? session.calleeId : session.callerId;
      io.to(`user:${otherUserId}`).emit('call:hangup', { callId });
    } catch {
      socket.emit('error', { message: 'Invalid call:hangup payload' });
    }
  });

  socket.on('call:reject', (data) => {
    try {
      const { callId } = callIdSchema.parse(data);
      const session = getCallSession(callId);
      if (!session || session.calleeId !== userId) return socket.emit('error', { message: 'Call not found' });
      endCallSession(callId);
      io.to(`user:${session.callerId}`).emit('call:reject', { callId });
    } catch {
      socket.emit('error', { message: 'Invalid call:reject payload' });
    }
  });

  socket.on('disconnect', () => {
    const callId = getActiveCallId(userId);
    if (callId) {
      const session = endCallSession(callId);
      if (session) {
        const otherUserId = session.callerId === userId ? session.calleeId : session.callerId;
        io.to(`user:${otherUserId}`).emit('call:hangup', { callId });
      }
    }
  });
}

export function setupSocketHandlers(io: Server) {
  const onlineSockets = new Map<string, Set<string>>();

  io.use(async (socket: Socket, next) => {
    const token = socket.handshake.auth.token as string | undefined;
    const tenantId = socket.handshake.auth.tenantId as string | undefined;
    if (!token || !tenantId) return next(new Error('Unauthorized'));
    try {
      const payload = verifyAccessToken(token);
      const membership = await prisma.tenantMembership.findUnique({
        where: { tenantId_userId: { tenantId, userId: payload.userId } },
      });
      if (!membership) return next(new Error('Unauthorized'));
      socket.data.userId = payload.userId;
      socket.data.tenantId = tenantId;
      return next();
    } catch {
      return next(new Error('Unauthorized'));
    }
  });

  io.on('connection', async (socket) => {
    const userId = socket.data.userId as string;
    const tenantId = socket.data.tenantId as string;

    socket.join(`user:${userId}`);

    const sockets = onlineSockets.get(userId) ?? new Set<string>();
    const wasOnline = sockets.size > 0;
    sockets.add(socket.id);
    onlineSockets.set(userId, sockets);

    socket.on('chat:join', async (data) => {
      try {
        const { chatId } = chatIdEventSchema.parse(data);
        const chat = await prisma.chat.findUnique({ where: { id: chatId } });
        if (!chat || chat.tenantId !== tenantId) {
          return socket.emit('error', { message: 'Not a chat member' });
        }
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
        const chat = await prisma.chat.findUnique({ where: { id: chatId } });
        if (!chat || chat.tenantId !== tenantId) {
          return socket.emit('error', { message: 'Not a chat member' });
        }
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
        io.to(`chat:${chatId}`).emit('message:new', formatMessage(message));
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
        const chat = await prisma.chat.findUnique({ where: { id: message.chatId } });
        if (!chat || chat.tenantId !== tenantId) {
          return socket.emit('error', { message: 'Not a chat member' });
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
            await broadcastPresence(io, userId, tenantId, false);
          } catch {
            // ignore
          }
        }
      }
    });

    setupCallHandlers(io, socket, userId);

    if (!wasOnline) {
      try {
        await broadcastPresence(io, userId, tenantId, true);
      } catch (err) {
        socket.emit('error', { message: 'Presence update failed' });
      }
    }
  });
}

async function broadcastPresence(io: Server, userId: string, tenantId: string, isOnline: boolean) {
  const contacts = await prisma.contact.findMany({
    where: {
      tenantId,
      ownerId: userId,
      status: 'accepted',
    },
    select: { targetId: true },
  });
  const targetIds = contacts.map((c) => c.targetId);

  const reverseContacts = await prisma.contact.findMany({
    where: {
      tenantId,
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
