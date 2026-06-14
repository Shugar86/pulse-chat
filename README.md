# Pulse Chat

<p align="center">
  <img src="docs/assets/logo.svg" alt="Pulse Chat" width="120" />
</p>

<p align="center">
  <b>Корпоративный мессенджер, который не торгует приватностью.</b><br/>
  Текстовые чаты · Аудиозвонки 1-to-1 · WireGuard VPN
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Expo-52-000020?logo=expo" alt="Expo" />
  <img src="https://img.shields.io/badge/React%20Native-0.76-61DAFB?logo=react" alt="React Native" />
  <img src="https://img.shields.io/badge/Node.js-22-339933?logo=nodedotjs" alt="Node.js" />
  <img src="https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/WireGuard-%E2%9C%93-88171A?logo=wireguard" alt="WireGuard" />
  <img src="https://img.shields.io/badge/license-MIT-green.svg" alt="License" />
</p>

---

## Что это

**Pulse Chat** — мобильный мессенджер для команд и компаний, которым важно держать общение под контролем. Никаких сторонних мессенджеров, никаких утечек метаданных, никаких «мы никогда не читаем ваши сообщения» на словах.

Здесь сообщения ходят через ваш сервер, звонки устанавливаются напрямую через WebRTC, а VPN-приватные ключи создаются прямо на устройстве и никогда его не покидают.

Для кого:

- Компании, которым нужен закрытый корпоративный чат.
- Команды, работающие с чувствительными данными.
- Разработчиков, которые хотят развернуть свой мессенджер на своей инфраструктуре.

## Возможности

| Возможность | Статус |
|-------------|--------|
| Регистрация / вход по email + JWT | ✅ |
| Мультитенантность (компании / tenant) | ✅ |
| Личные и групповые текстовые чаты | ✅ |
| Статус доставки и прочтения сообщений | ✅ |
| Аудиозвонки 1-to-1 через WebRTC | ✅ |
| Signaling через Socket.io | ✅ |
| Собственный TURN-сервер (coturn) | ✅ |
| WireGuard VPN-конфиг из приложения | ✅ |
| Клиентская генерация VPN-ключей | ✅ |
| Android push-уведомления о звонках (FCM) | ✅ |
| Продакшен Docker Compose + nginx + SSL | ✅ |

## Архитектура

```
┌─────────────────────────────────────────────┐
│  iOS / Android (EAS Build)                  │
│  React Native + react-native-webrtc         │
│  WireGuard config import / auto-tunnel      │
└──────────────┬──────────────────────────────┘
               │ HTTPS / WSS
               ▼
┌─────────────────────────────────────────────┐
│  VDS                                        │
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

## Стек

- **Frontend:** Expo SDK 52, React Native 0.76, TypeScript, React Navigation 7, i18next, Zustand, TanStack Query
- **Backend:** Node.js 22, Express, Socket.io, JWT, Prisma, Zod
- **Database:** PostgreSQL 16, Redis 7
- **Real-time:** Socket.io (messages + call signaling)
- **Media:** WebRTC, react-native-webrtc
- **VPN:** WireGuard, wg-easy, react-native-wireguard-vpn
- **Infra:** Docker Compose, nginx, certbot, coturn
- **Push:** Firebase Cloud Messaging (Android)

## Структура репозитория

```text
pulse-chat/
├── apps/
│   └── mobile/              # Expo + React Native приложение
├── services/
│   └── api/                 # Node.js backend
├── packages/
│   ├── shared/              # общие типы и константы
│   └── ts-config/           # общий tsconfig
├── deploy/
│   └── nginx/               # nginx config + SSL init script
├── docker-compose.yml       # локальная разработка
├── docker-compose.prod.yml  # продакшен
├── .env.example             # env переменные
└── docs/
    ├── superpowers/specs/   # дизайн-документы
    └── superpowers/plans/   # планы реализации
```

## Быстрый старт (локально)

```bash
# 1. Клонировать репозиторий
git clone git@github.com:Shugar86/pulse-chat.git
cd pulse-chat

# 2. Зависимости
pnpm install

# 3. Переменные окружения
cp .env.example .env                 # для Docker Compose
cp .env.example services/api/.env    # для бэкенда
# отредактируй оба файла

# 4. Поднять инфраструктуру
docker compose up -d

# 5. Применить схему Prisma
cd services/api
pnpm exec prisma db push

# 6. Запустить бэкенд
pnpm dev

# 7. В другом окне запустить мобильное приложение
cd ../../apps/mobile
pnpm start
```

## Production deployment

1. Направь домены на VDS:
   - `api.pulse.chat`
   - `vpn.pulse.chat`
   - `turn.pulse.chat`

2. Скопируй и заполни `.env`:

```bash
cp .env.example .env
# отредактируй все секреты
```

3. Получи SSL-сертификаты:

```bash
bash deploy/nginx/init-ssl.sh
```

4. Запусти продакшен:

```bash
docker compose -f docker-compose.prod.yml up -d
```

5. Получи `WG_SERVER_PUBLIC_KEY` из контейнера `wg-easy` и обнови `.env`.

6. Собери мобильное приложение:

```bash
cd apps/mobile
EXPO_PUBLIC_API_URL=https://api.pulse.chat eas build --platform android
# или --platform ios
```

## Тестирование

```bash
# backend
pnpm test

# lint
pnpm lint
```

## Безопасность

- VPN-приватные ключи генерируются на устройстве и не покидают его.
- Сервер хранит только публичные ключи WireGuard.
- TURN-credentials выдаются с ограниченным сроком жизни через HMAC.
- Аутентификация по JWT, мультитенантная изоляция через `X-Tenant-Id`.

## Документация

- [AGENTS.md](./AGENTS.md) — контракт для AI-агентов
- [CONTRIBUTING.md](./CONTRIBUTING.md) — как участвовать
- [CHANGELOG.md](./CHANGELOG.md) — история изменений
- [LICENSE](./LICENSE) — лицензия MIT
- [Дизайн Phase 1](./docs/superpowers/specs/2026-06-12-pulse-chat-design.md)
- [Дизайн Phase 1 Polish](./docs/superpowers/specs/2026-06-12-pulse-chat-phase1-polish-design.md)
- [VPN + Robustness Design](./docs/superpowers/specs/2026-06-13-vpn-and-robustness-design.md)
- [Production MVP Design](./docs/superpowers/specs/2026-06-13-production-mvp-design.md)

---

<p align="center">
  Built with <a href="https://github.com/Shugar86/vibecraft-manifest">VibeCraft</a> methodology.
</p>
