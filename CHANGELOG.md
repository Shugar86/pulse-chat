# Changelog

Все значимые изменения фиксируются в этом файле.

Формат основан на [Keep a Changelog](https://keepachangelog.com/ru/1.0.0/).

## [Unreleased]

### Added

- Vibe-first документация: README, AGENTS, LICENSE, CONTRIBUTING, CHANGELOG.

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
