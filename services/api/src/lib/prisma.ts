import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();

async function disconnect() {
  await prisma.$disconnect();
}

process.on('SIGTERM', disconnect);
process.on('SIGINT', disconnect);
