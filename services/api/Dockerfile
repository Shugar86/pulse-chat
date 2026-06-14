# Build from the monorepo root so pnpm can resolve the workspace and lockfile.
# Build context must be the repository root (see docker-compose.prod.yml).
FROM node:22-alpine AS builder
WORKDIR /app
RUN corepack enable
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @pulse-chat/api exec prisma generate
RUN pnpm --filter @pulse-chat/api run build
# Produce a self-contained directory with a flattened node_modules.
RUN pnpm --filter @pulse-chat/api deploy --prod /deploy
# Generate the Prisma client inside the deployed node_modules.
RUN cd /deploy && node node_modules/prisma/build/index.js generate

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /deploy/node_modules ./node_modules
COPY --from=builder /deploy/dist ./dist
COPY --from=builder /deploy/prisma ./prisma
COPY --from=builder /deploy/package.json ./
COPY --from=builder /app/services/api/docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh
EXPOSE 4000
ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "dist/index.js"]
