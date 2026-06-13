import { io as ClientIO, Socket as ClientSocket } from 'socket.io-client';
import request from 'supertest';
import { createApp, createHttpServer, createIOServer } from '../src/server';
import { setupSocketHandlers } from '../src/lib/socket';
import { prisma } from '../src/lib/prisma';

const app = createApp();
const httpServer = createHttpServer(app);
const io = createIOServer(httpServer);
setupSocketHandlers(io);

beforeAll((done) => {
  httpServer.listen(0, done);
});

afterAll(async () => {
  io.close();
  httpServer.close();
  await prisma.$disconnect();
});

beforeEach(async () => {
  await prisma.vpnPeer.deleteMany();
  await prisma.tenantInvite.deleteMany();
  await prisma.tenantMembership.deleteMany();
  await prisma.tenant.deleteMany();
  await prisma.user.deleteMany();
});

async function createUser(email: string, password: string, displayName: string) {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ email, password, displayName, tenantName: displayName });
  return {
    user: res.body.user,
    tenantId: res.body.user.tenants[0].tenantId,
    token: res.body.tokens.accessToken,
  };
}

function connectSocket(token: string, tenantId: string): Promise<ClientSocket> {
  return new Promise((resolve) => {
    const port = (httpServer.address() as any).port;
    const socket = ClientIO(`http://localhost:${port}`, {
      auth: { token, tenantId },
    });
    socket.on('connect', () => resolve(socket));
  });
}

describe('Call signaling', () => {
  it('forwards offer to callee and answer back to caller', async () => {
    const alice = await createUser('alice@example.com', 'secret123', 'Alice');
    const bob = await createUser('bob@example.com', 'secret123', 'Bob');
    const aliceSocket = await connectSocket(alice.token, alice.tenantId);
    const bobSocket = await connectSocket(bob.token, bob.tenantId);

    const incoming = new Promise<any>((resolve) => bobSocket.on('call:incoming', resolve));
    const answerBack = new Promise<any>((resolve) => aliceSocket.on('call:answer', resolve));

    const callId = '11111111-1111-1111-1111-111111111111';
    aliceSocket.emit('call:offer', { callId, toUserId: bob.user.id, sdp: 'offer-sdp' });

    const inc = await incoming;
    expect(inc.callId).toBe(callId);
    expect(inc.sdp).toBe('offer-sdp');

    bobSocket.emit('call:answer', { callId, sdp: 'answer-sdp' });
    const ans = await answerBack;
    expect(ans.sdp).toBe('answer-sdp');

    aliceSocket.close();
    bobSocket.close();
  });
});
