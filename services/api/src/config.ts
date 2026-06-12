import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  PORT: z.string().transform(Number).default('4000'),
  DATABASE_URL: z.string().url().default('postgresql://postgres:postgres@localhost:5432/pulsechat?schema=public'),
  CORS_ORIGIN: z.string().default('*'),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
});

const env = envSchema.parse(process.env);

export const config = {
  port: env.PORT,
  databaseUrl: env.DATABASE_URL,
  corsOrigin: env.CORS_ORIGIN,
  jwtAccessSecret: env.JWT_ACCESS_SECRET,
  jwtRefreshSecret: env.JWT_REFRESH_SECRET,
  accessTokenTtl: '15m',
  refreshTokenTtl: '7d',
} as const;
