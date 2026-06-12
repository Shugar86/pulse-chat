import jwt from 'jsonwebtoken';
import { config } from '../config.js';

export type TokenPayload = { userId: string; email: string };

export function signAccessToken(payload: TokenPayload) {
  return jwt.sign(payload, config.jwtAccessSecret, { expiresIn: config.accessTokenTtl });
}

export function signRefreshToken(payload: TokenPayload) {
  return jwt.sign(payload, config.jwtRefreshSecret, { expiresIn: config.refreshTokenTtl });
}

export function verifyAccessToken(token: string): TokenPayload {
  return jwt.verify(token, config.jwtAccessSecret) as TokenPayload;
}
