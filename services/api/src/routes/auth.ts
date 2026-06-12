import { Router } from 'express';
import argon2 from 'argon2';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { signAccessToken, signRefreshToken, verifyRefreshToken, TokenPayload } from '../lib/jwt.js';
import { ApiError } from '../middleware/error.js';

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  displayName: z.string().min(1),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

export const authRouter: Router = Router();

authRouter.post('/register', async (req, res, next) => {
  try {
    const data = registerSchema.parse(req.body);
    const email = data.email.toLowerCase();
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) throw new ApiError(409, 'Email already in use');
    const passwordHash = await argon2.hash(data.password);
    const user = await prisma.user.create({
      data: { email, passwordHash, displayName: data.displayName },
      select: { id: true, email: true, displayName: true, preferredLanguage: true },
    });
    const tokens = {
      accessToken: signAccessToken({ userId: user.id, email: user.email }),
      refreshToken: signRefreshToken({ userId: user.id, email: user.email }),
    };
    res.status(201).json({ user, tokens });
  } catch (err) {
    next(err);
  }
});

authRouter.post('/login', async (req, res, next) => {
  try {
    const data = loginSchema.parse(req.body);
    const email = data.email.toLowerCase();
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) throw new ApiError(401, 'Invalid credentials');
    const valid = await argon2.verify(user.passwordHash, data.password);
    if (!valid) throw new ApiError(401, 'Invalid credentials');
    const tokens = {
      accessToken: signAccessToken({ userId: user.id, email: user.email }),
      refreshToken: signRefreshToken({ userId: user.id, email: user.email }),
    };
    res.json({
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        preferredLanguage: user.preferredLanguage,
      },
      tokens,
    });
  } catch (err) {
    next(err);
  }
});

authRouter.post('/refresh', async (req, res, next) => {
  try {
    const { refreshToken } = refreshSchema.parse(req.body);
    let payload: TokenPayload;
    try {
      payload = verifyRefreshToken(refreshToken);
    } catch {
      throw new ApiError(401, 'Invalid refresh token');
    }
    const accessToken = signAccessToken({ userId: payload.userId, email: payload.email });
    res.json({ accessToken });
  } catch (err) {
    next(err);
  }
});
