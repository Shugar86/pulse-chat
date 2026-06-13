import crypto from 'node:crypto';
import { config } from '../config.js';

export function generateTurnCredentials(userId: string) {
  const ttl = 24 * 60 * 60; // 24 hours
  const timestamp = Math.floor(Date.now() / 1000) + ttl;
  const username = `${timestamp}:${userId}`;
  const hmac = crypto.createHmac('sha1', config.turn.secret);
  hmac.update(username);
  const credential = hmac.digest('base64');
  return {
    username,
    credential,
    urls: [`turn:${config.turn.host}:${config.turn.port}`],
  };
}
