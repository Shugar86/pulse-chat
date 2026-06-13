# pulse-chat

Корпоративный мобильный мессенджер со встроенным VPN. Pet-проект.

## Идея

Приложение для командной коммуникации: текстовые чаты, аудиозвонки и встроенный VPN-клиент на базе WireGuard. Разработка идёт поэтапно — от простого к сложному.

## Фазы

| Фаза | Что внутри |
|------|-----------|
| **Phase 1 — Core messenger** | Регистрация/логин, контакты, личные и групповые чаты, доставка и прочтение сообщений, локализация ru/en |
| **Phase 2 — Audio calls** | Аудиозвонки 1-to-1 через WebRTC, сигналинг по Socket.io |
| **Phase 3 — Built-in VPN** | Нативный WireGuard-клиент для iOS/Android, управление туннелем из приложения |

Подробный дизайн-документ: [`docs/superpowers/specs/2026-06-12-pulse-chat-design.md`](./docs/superpowers/specs/2026-06-12-pulse-chat-design.md).

## Стек

- **Клиент:** Expo / React Native, TypeScript, React Navigation, i18next, Zustand, TanStack Query
- **Бэкенд:** Node.js, Express, Socket.io, JWT, Prisma
- **База данных:** PostgreSQL
- **Инфраструктура:** Docker Compose, pnpm workspaces
- **VPN:** WireGuard (сервер) + WireGuardKit / wireguard-android (нативные модули)

## Структура репо (план)

```
pulse-chat/
├── apps/
│   └── mobile/              # Expo + React Native
├── services/
│   └── api/                 # Node.js backend
├── packages/
│   ├── shared/              # общие типы и константы
│   └── ts-config/           # общий tsconfig
├── docker-compose.yml
├── .env.example
└── docs/
```

## Быстрый старт

```bash
# 1. Зависимости
pnpm install

# 2. Переменные окружения
cp .env.example .env                 # для Docker Compose
cp .env.example services/api/.env    # для бэкенда
# отредактируй оба файла, убедись что DATABASE_URL указывает на запущенный Postgres

# 3. База данных
docker compose up -d
cd services/api
pnpm exec prisma migrate dev

# 4. Бэкенд
pnpm dev

# 5. Мобильное приложение (новое окно)
cd ../../apps/mobile
pnpm start
```

> Phase 1 UI polish applied — warm slate theme, consistent components, empty states, micro-animations.
> Multitenancy MVP applied — users/companies isolated via `Tenant`/`TenantMembership`, active tenant selected on mobile and sent as `X-Tenant-Id` header / socket auth.

## VPN (MVP)

Pulse Chat can provision a per-user, per-tenant WireGuard VPN. The server generates client keys for the MVP; future releases will move key generation to the device.

### Local setup

1. Copy `.env.example` to `.env` and fill `WG_SERVER_PUBLIC_KEY` after starting WireGuard once.
2. Start the stack: `docker compose up -d`
3. Create the API peer config via mobile or curl: `POST /api/vpn/config`.
4. Import the returned `config` string into your WireGuard client.

### Security note

Private keys are currently stored in the database. Do not use this for production secrets; migrate to client-side key generation before a real rollout.

### Security improvements

Starting with this polish round, VPN private keys are generated on the mobile device. The server stores only the client's public key and the server-side public key. Private keys never leave the device.

## Правила для агентов

См. [`AGENTS.md`](./AGENTS.md) и глобальный канон `~/dev/agent-os/AGENTS.md`.

## Production deployment

1. Point domains `api.pulse.chat`, `vpn.pulse.chat`, `turn.pulse.chat` to your VDS.
2. Copy `.env.example` to `.env` and fill all secrets.
3. Run `bash deploy/nginx/init-ssl.sh` to obtain certificates.
4. Start services: `docker compose -f docker-compose.prod.yml up -d`.
5. Build mobile app with `EXPO_PUBLIC_API_URL=https://api.pulse.chat`.
