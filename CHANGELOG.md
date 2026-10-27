# Changelog

Все значимые изменения фиксируются в этом файле.

Формат основан на [Keep a Changelog](https://keepachangelog.com/ru/1.0.0/), а версионирование следует [Semantic Versioning](https://semver.org/lang/ru/).

## [Unreleased]

### Добавлено

- Vibe-first документация: README, AGENTS, LICENSE, CONTRIBUTING, CHANGELOG.

### Изменено

- Полировка документации до 10/10: единый вайб, TOC, примеры команд, CI badge, уточнённая архитектура и структура репозитория.
- `prisma` перенесён в runtime-зависимости API — нужен для применения миграций в контейнере.

### Исправлено

- Миграции БД приведены в соответствие со схемой: добавлена миграция `add_multitenancy_vpn_push` (`Tenant`, `TenantMembership`, `TenantInvite`, `VpnPeer`, `PushToken`, `tenantId` в `Chat`/`Contact`). Раньше эти таблицы существовали только через `prisma db push`, и `migrate deploy` на свежей БД создавал неполную схему.
- Прод-деплой теперь применяет миграции при старте контейнера через `docker-entrypoint.sh` (`prisma migrate deploy`). Раньше схема в проде не создавалась вовсе.
- Docker-сборка API чинится для монорепо: контекст — корень репозитория, сборка через `pnpm deploy`. Прежний контекст `./services/api` не содержал lockfile и workspace, сборка не проходила.

## [0.1.0] — 2026-06-14

### Добавлено

- Мессенджер: регистрация/логин, контакты, личные и групповые чаты.
- Мультитенантность: пользователи и компании изолированы через `Tenant`/`TenantMembership`.
- Аудиозвонки 1-to-1 через WebRTC (`react-native-webrtc`) и Socket.io signaling.
- Собственный TURN-сервер `coturn` с HMAC-credentials.
- WireGuard VPN-конфиг из приложения, клиентская генерация ключей.
- Автоматическое подключение VPN-туннеля из приложения через `react-native-wireguard-vpn`.
- Android push-уведомления о входящих звонках через Firebase Cloud Messaging.
- Продакшен Docker Compose: nginx reverse proxy, Let's Encrypt SSL, wg-easy, coturn.
- Централизованная валидация Zod, rate limiter, security headers, health checks, graceful shutdown.
- Локализация ru/en.

### Безопасность

- VPN-приватные ключи генерируются на устройстве и не покидают его.
- Сервер хранит только публичные ключи WireGuard.
- TURN-credentials выдаются с ограниченным сроком жизни.

## [0.0.1] — 2026-06-12

### Добавлено

- Phase 1 core messenger MVP.
- Базовая структура монорепозитория на pnpm workspaces.

[Unreleased]: https://github.com/Shugar86/pulse-chat/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/Shugar86/pulse-chat/compare/v0.0.1...v0.1.0
[0.0.1]: https://github.com/Shugar86/pulse-chat/releases/tag/v0.0.1
