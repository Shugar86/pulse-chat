import 'dotenv/config';

export const config = {
  port: Number(process.env.PORT || 4000),
  databaseUrl: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/pulsechat?schema=public',
  jwtAccessSecret: process.env.JWT_ACCESS_SECRET || 'dev-access-secret-min-32-characters-long',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret-min-32-characters-long',
  accessTokenTtl: '15m',
  refreshTokenTtl: '7d',
};
