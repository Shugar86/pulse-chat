import { initializeApp, cert } from 'firebase-admin';
import { getMessaging } from 'firebase-admin/messaging';
import { config } from '../config.js';
import { prisma } from './prisma.js';

let initialized = false;

function initApp() {
  if (!config.firebaseServiceAccount) return false;
  if (!initialized) {
    const serviceAccount = JSON.parse(config.firebaseServiceAccount);
    initializeApp({
      credential: cert(serviceAccount),
    });
    initialized = true;
  }
  return true;
}

export async function sendIncomingCallPush(userId: string, callerName: string) {
  if (!initApp()) return;

  const tokens = await prisma.pushToken.findMany({
    where: { userId, platform: 'android' },
    select: { token: true },
  });

  if (tokens.length === 0) return;

  const messaging = getMessaging();
  const message = {
    data: {
      type: 'incoming_call',
      callerName,
    },
    tokens: tokens.map((t) => t.token),
  };

  try {
    await messaging.sendEachForMulticast(message);
  } catch (err) {
    console.error('Failed to send push', err);
  }
}
