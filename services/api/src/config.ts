import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().int().min(1).default(4000),
  DATABASE_URL: z.string().url().default('postgresql://postgres:postgres@localhost:5432/pulsechat?schema=public'),
  CORS_ORIGIN: z.string(),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  WG_SERVER_PUBLIC_KEY: z.string().min(1).default(''),
  WG_ENDPOINT: z.string().min(1).default(''),
  WG_DNS: z.string().min(1).default('1.1.1.1'),
  WG_ALLOWED_IPS: z.string().min(1).default('0.0.0.0/0, ::/0'),
  WG_NETWORK: z.string().min(1).default('10.200.0.0/24'),
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
  wg: {
    serverPublicKey: env.WG_SERVER_PUBLIC_KEY,
    endpoint: env.WG_ENDPOINT,
    dns: env.WG_DNS,
    allowedIps: env.WG_ALLOWED_IPS,
    network: env.WG_NETWORK,
  },
} as const;
