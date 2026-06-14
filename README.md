# Pulse Chat

<p align="center">
  <img src="docs/assets/logo.svg" alt="Pulse Chat" width="120" />
</p>

<p align="center">
  <b>Корпоративный мессенджер, который не торгует приватностью.</b><br/>
  Текстовые чаты · Аудиозвонки 1-to-1 · WireGuard VPN
</p>

<p align="center">
  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-MIT-green.svg" alt="License: MIT" /></a>
  <img src="https://img.shields.io/badge/version-0.1.0-blue.svg" alt="Version" />
  <a href="https://github.com/Shugar86/pulse-chat/actions/workflows/ci.yml"><img src="https://github.com/Shugar86/pulse-chat/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <img src="https://img.shields.io/badge/pnpm-9-F69220?logo=pnpm" alt="pnpm 9" />
  <img src="https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript" alt="TypeScript 5.7" />
  <img src="https://img.shields.io/badge/Expo-52-000020?logo=expo" alt="Expo SDK 52" />
  <img src="https://img.shields.io/badge/React%20Native-0.76-61DAFB?logo=react" alt="React Native 0.76" />
  <img src="https://img.shields.io/badge/Node.js-22-339933?logo=nodedotjs" alt="Node.js 22" />
  <img src="https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql" alt="PostgreSQL 16" />
  <img src="https://img.shields.io/badge/Redis-7-DC382D?logo=redis" alt="Redis 7" />
  <img src="https://img.shields.io/badge/WireGuard-%E2%9C%93-88171A?logo=wireguard" alt="WireGuard" />
</p>

---

## Содержание

- [Что это](#что-это)
- [Возможности](#возможности)
- [Архитектура](#архитектура)
- [Стек](#стек)
- [Структура репозитория](#структура-репозитория)
- [Быстрый старт](#быстрый-старт)
- [Production deployment](#production-deployment)
- [Примеры](#примеры)
- [Тестирование](#тестирование)
- [Безопасность](#безопасность)
- [Дорожная карта](#дорожная-карта)
- [Участие](#участие)
- [Лицензия](#лицензия)

---

## Что это

**Pulse Chat** — мобильный мессенджер для команд и компаний, которым важно держать общение под контролем. Никаких сторонних мессенджеров, никаких утечек метаданных, никаких «мы никогда не читаем ваши сообщения» на словах.

Сообщения ходят через ваш сервер, звонки устанавливаются напрямую через WebRTC, а VPN-приватные ключи создаются прямо на устройстве и никогда его не покидают.

Для кого:

- Компании, которым нужен закрытый корпоративный чат.
- Команды, работающие с чувствительными данными.
- Разработчики, которые хотят развернуть свой мессенджер на своей инфраструктуре.

---

## Возможности

| Возможность | Статус | Описание |
|-------------|--------|----------|
| Регистрация / вход по email + JWT | ✅ | Access + refresh токены, защищённые эндпоинты. |
| Мультитенантность (компании / tenant) | ✅ | Изоляция пользователей и данных через `Tenant` / `TenantMembership`. |
| Личные и групповые текстовые чаты | ✅ | Сообщения, статус доставки и прочтения. |
| Аудиозвонки 1-to-1 через WebRTC | ✅ | Прямое P2P-соединение, где это возможно. |
| Signaling через Socket.io | ✅ | Надёжная сигнализация звонков и сообщений в реальном времени. |
| Собственный TURN-сервер (coturn) | ✅ | Обход NAT и симметричных файрволов с HMAC-credentials. |
| WireGuard VPN-конфиг из приложения | ✅ | Генерация конфига без ручных настроек. |
| Клиентская генерация VPN-ключей | ✅ | Приватный ключ никогда не покидает устройство. |
| Android push-уведомления о звонках (FCM) | ✅ | Входящий звонок даже когда приложение в фоне. |
| Продакшен Docker Compose + nginx + SSL | ✅ | Готовый стек для собственного VDS. |

---

## Архитектура

```text
┌─────────────────────────────────────────────┐
│  iOS / Android (EAS Build)                  │
│  React Native + react-native-webrtc         │
│  WireGuard config import / auto-tunnel      │
└──────────────┬──────────────────────────────┘
               │ HTTPS / WSS
               ▼
┌─────────────────────────────────────────────┐
│  VDS / собственный сервер                   │
│  ┌─────────────────────────────────────┐    │
│  │  nginx (reverse proxy, SSL)         │    │
│  │  api.pulse.chat  → api:4000         │    │
│  │  vpn.pulse.chat  → wg-easy          │    │
│  │  turn.pulse.chat → coturn           │    │
│  └─────────────────────────────────────┘    │
│  ┌────────┐ ┌────────┐ ┌──────────────┐     │
│  │  API   │ │ coturn │ │   wg-easy    │     │
│  │ Node   │ │  TURN  │ │  WireGuard   │     │
│  └────┬───┘ └────────┘ └──────────────┘     │
│       │                                      │
│  ┌────┴────┐ ┌────────┐                     │
│  │PostgreSQL│ │ Redis  │                     │
│  └─────────┘ └────────┘                     │
└─────────────────────────────────────────────┘
```

---

## Стек

| Область | Технология | Назначение |
|---------|------------|------------|
| Mobile | Expo SDK 52, React Native 0.76, TypeScript | Кроссплатформенное приложение |
| Navigation | React Navigation 7 | Навигация между экранами |
| State | Zustand | Локальный стейт |
| Server state | TanStack Query | Кеширование серверных данных |
| i18n | i18next | Локализация ru / en |
| Backend | Node.js 22, Express, Socket.io | REST API + real-time signaling |
| Auth | JWT (access + refresh) | Аутентификация и авторизация |
| ORM / DB | Prisma, PostgreSQL 16 | Реляционные данные |
| Cache / PubSub | Redis 7 | Кеш, сессии, очереди |
| Calls | WebRTC, react-native-webrtc | P2P аудиозвонки |
| Signaling | Socket.io | Сигнализация звонков и сообщений |
| TURN | coturn с HMAC-credentials | Обход NAT / файрволов |
| VPN | WireGuard, wg-easy, react-native-wireguard-vpn | Приватный туннель |
| Infra | Docker Compose, nginx, certbot | Контейнеризация и SSL |
| Push | Firebase Cloud Messaging (Android) | Push о входящих звонках |
| Workspaces | pnpm 9 | Монорепозиторий |

---

## Структура репозитория

```text
pulse-chat/
├── apps/
│   └── mobile/              # Expo + React Native приложение
├── services/
│   └── api/                 # Node.js backend (Express + Socket.io)
├── packages/
│   └── shared/              # общие типы, схемы и константы
├── deploy/
│   └── nginx/               # nginx config + SSL init script
├── docker-compose.yml       # локальная разработка (postgres, redis, wireguard)
├── docker-compose.prod.yml  # продакшен (api, coturn, wg-easy, nginx, ssl)
├── .env.example             # env переменные
└── docs/
    ├── assets/              # логотипы и медиа
    ├── superpowers/specs/   # дизайн-документы
    └── superpowers/plans/   # планы реализации
```

---

## Быстрый старт

Для разработки нужен **Node.js ≥ 22**, **pnpm ≥ 9** и **Docker** с Docker Compose.

```bash
# 1. Клонировать репозиторий
git clone git@github.com:Shugar86/pulse-chat.git
cd pulse-chat

# 2. Установить зависимости
pnpm install

# 3. Подготовить переменные окружения
#    - корневой .env используется docker compose (postgres, redis, wireguard)
#    - services/api/.env используется бэкендом
#    - apps/mobile/.env используется Expo (EXPO_PUBLIC_API_URL)
cp .env.example .env
cp .env.example services/api/.env
cp .env.example apps/mobile/.env
# отредактируйте JWT-секреты (минимум 32 символа), CORS_ORIGIN и EXPO_PUBLIC_API_URL

# 4. Поднять инфраструктуру
docker compose up -d

# 5. Сгенерировать Prisma-клиент и применить схему
pnpm db:generate
pnpm db:push

# 6. Запустить бэкенд
pnpm -C services/api dev

# 7. В другом окне запустить мобильное приложение
pnpm -C apps/mobile start
# затем отсканируйте QR-код в Expo Go (iOS / Android)
```

> **Примечание:** для корректной работы WebRTC на реальном устройстве нужен доступ к API по сети, а не `localhost`. Используйте `EXPO_PUBLIC_API_URL=http://<your-lan-ip>:4000`.

---

## Production deployment

1. Направьте домены на VDS:
   - `api.pulse.chat`
   - `vpn.pulse.chat`
   - `turn.pulse.chat`

2. Скопируйте и заполните `.env`:

   ```bash
   cp .env.example .env
   # отредактируйте все секреты и домены
   ```

3. Получите SSL-сертификаты:

   ```bash
   bash deploy/nginx/init-ssl.sh
   ```

4. Запустите продакшен:

   ```bash
   docker compose -f docker-compose.prod.yml up -d
   ```

5. Получите `WG_SERVER_PUBLIC_KEY` из контейнера `wg-easy` и обновите `.env`.

6. Соберите мобильное приложение:

   ```bash
   cd apps/mobile
   EXPO_PUBLIC_API_URL=https://api.pulse.chat eas build --platform android
   # или --platform ios
   ```

---

## Примеры

### Регистрация пользователя

```bash
curl -X POST http://localhost:4000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@company.com",
    "password": "strong-password",
    "name": "Иван Петров",
    "companyName": "Acme"
  }'
```

### Получение TURN-credentials

```bash
curl -H "Authorization: Bearer <access-token>" \
  http://localhost:4000/calls/turn-credentials
```

### Запуск тестов

```bash
# все пакеты
pnpm test

# только бэкенд
pnpm -C services/api test

# линтер
pnpm lint

# typecheck
pnpm typecheck
```

---

## Тестирование

```bash
# backend
pnpm -C services/api test

# lint
pnpm lint

# typecheck
pnpm typecheck
```

---

## Безопасность

- VPN-приватные ключи генерируются на устройстве и не покидают его.
- Сервер хранит только публичные ключи WireGuard.
- TURN-credentials выдаются с ограниченным сроком жизни через HMAC.
- Аутентификация по JWT, мультитенантная изоляция через `X-Tenant-Id`.

---

## Дорожная карта

См. [CHANGELOG.md](./CHANGELOG.md) для истории изменений и текущего статуса.

Ближайшие направления:

- [ ] Push-уведомления для сообщений (не только звонки).
- [ ] iOS push через APNs.
- [ ] Удаляемые и редактируемые сообщения.
- [ ] Голосовые сообщения.
- [ ] E2E-шифрование для сообщений.

---

## Участие

- [AGENTS.md](./AGENTS.md) — контракт для AI-агентов
- [CONTRIBUTING.md](./CONTRIBUTING.md) — как участвовать
- [CHANGELOG.md](./CHANGELOG.md) — история изменений
- [LICENSE](./LICENSE) — лицензия MIT

---

## Лицензия

[MIT](./LICENSE) © 2026 Shugar86

---

<p align="center">
  Built with <a href="https://github.com/Shugar86/vibecraft-manifest">VibeCraft</a> methodology.
</p>
