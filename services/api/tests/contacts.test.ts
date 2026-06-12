import request from 'supertest';
import { createApp } from '../src/server';
import { prisma } from '../src/lib/prisma';
import { signAccessToken } from '../src/lib/jwt';

const app = createApp();

async function createUser(email: string, password: string, displayName: string) {
  const res = await request(app).post('/api/auth/register').send({ email, password, displayName });
  return res.body.user as { id: string; email: string };
}

function tokenFor(userId: string, email: string) {
  return signAccessToken({ userId, email });
}

beforeEach(async () => {
  await prisma.contact.deleteMany();
  await prisma.chatMember.deleteMany();
  await prisma.chat.deleteMany();
  await prisma.user.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('Contacts', () => {
  it('creates a contact request and accepts it', async () => {
    const alice = await createUser('alice@example.com', 'secret123', 'Alice');
    const bob = await createUser('bob@example.com', 'secret123', 'Bob');

    const reqRes = await request(app)
      .post('/api/contacts')
      .set('Authorization', `Bearer ${tokenFor(alice.id, alice.email)}`)
      .send({ targetId: bob.id });
    expect(reqRes.status).toBe(201);

    const acceptRes = await request(app)
      .patch(`/api/contacts/${reqRes.body.id}`)
      .set('Authorization', `Bearer ${tokenFor(alice.id, alice.email)}`)
      .send({ status: 'accepted' });
    expect(acceptRes.status).toBe(200);

    const chats = await prisma.chat.findMany({ include: { members: true } });
    expect(chats.length).toBe(1);
    expect(chats[0].members.map((m) => m.userId).sort()).toEqual([alice.id, bob.id].sort());
  });

  it('lists contacts', async () => {
    const alice = await createUser('alice@example.com', 'secret123', 'Alice');
    const bob = await createUser('bob@example.com', 'secret123', 'Bob');
    await request(app)
      .post('/api/contacts')
      .set('Authorization', `Bearer ${tokenFor(alice.id, alice.email)}`)
      .send({ targetId: bob.id });

    const listRes = await request(app)
      .get('/api/contacts')
      .set('Authorization', `Bearer ${tokenFor(alice.id, alice.email)}`);
    expect(listRes.status).toBe(200);
    expect(listRes.body.length).toBe(1);
  });

  it('rejects adding yourself', async () => {
    const alice = await createUser('alice-self@example.com', 'secret123', 'Alice');
    const res = await request(app)
      .post('/api/contacts')
      .set('Authorization', `Bearer ${tokenFor(alice.id, alice.email)}`)
      .send({ targetId: alice.id });
    expect(res.status).toBe(400);
  });

  it('rejects adding non-existent user', async () => {
    const alice = await createUser('alice-missing@example.com', 'secret123', 'Alice');
    const res = await request(app)
      .post('/api/contacts')
      .set('Authorization', `Bearer ${tokenFor(alice.id, alice.email)}`)
      .send({ targetId: '00000000-0000-0000-0000-000000000000' });
    expect(res.status).toBe(404);
  });

  it('rejects accepting a blocked contact', async () => {
    const alice = await createUser('alice-block@example.com', 'secret123', 'Alice');
    const bob = await createUser('bob-block@example.com', 'secret123', 'Bob');
    const reqRes = await request(app)
      .post('/api/contacts')
      .set('Authorization', `Bearer ${tokenFor(alice.id, alice.email)}`)
      .send({ targetId: bob.id });
    await prisma.contact.create({
      data: { ownerId: bob.id, targetId: alice.id, status: 'pending' },
    });
    await prisma.contact.update({
      where: { ownerId_targetId: { ownerId: bob.id, targetId: alice.id } },
      data: { status: 'blocked' },
    });
    const acceptRes = await request(app)
      .patch(`/api/contacts/${reqRes.body.id}`)
      .set('Authorization', `Bearer ${tokenFor(alice.id, alice.email)}`)
      .send({ status: 'accepted' });
    expect(acceptRes.status).toBe(403);
  });
});
