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

## Правила для агентов

См. [`AGENTS.md`](./AGENTS.md) и глобальный канон `~/dev/agent-os/AGENTS.md`.
