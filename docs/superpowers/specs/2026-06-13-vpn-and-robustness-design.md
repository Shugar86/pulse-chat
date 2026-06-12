# pulse-chat — VPN + Robustness Design

- **Date:** 2026-06-13
- **Status:** Implementation-ready
- **Project root:** `~/dev/pulse-chat`

## Current state

Multitenancy MVP is complete:
- Backend isolates users/companies via `Tenant`/`TenantMembership` and requires `X-Tenant-Id`.
- Mobile selects active tenant, injects header, reconnects socket per tenant.
- Phase 1 messenger screens (auth, contacts, chats, profile) are polished.

## Goal

1. **Harden the MVP** — better validation, error handling, offline awareness, tests.
2. **Add corporate full-device VPN** — WireGuard tunnel that carries the messenger and future audio traffic.

## Non-goals

- Video calls.
- Traffic split-routing / per-app VPN.
- Push notifications.
- Production-grade key custody (private keys are server-generated for the MVP).
- E2E encryption beyond TLS/WireGuard transport.

## Decomposition

The work is split into two independent tracks that can be built in parallel:

1. **Robustness & polish MVP** — pure code, fully testable in this environment.
2. **VPN foundation** — backend peer/config service + mobile integration (native build steps documented).

## Track 1 — Robustness & polish

### Backend

- Centralize input validation helpers and reuse schemas.
- Add global rate-limiting on auth endpoints (simple in-memory store).
- Add request-id / structured logging middleware.
- Add `zod` error formatter to return field-level messages.
- Expand tests:
  - duplicate email registration,
  - invalid tenant header,
  - unauthorized chat/contact access across tenants,
  - invalid invite code/expired invite,
  - refresh token reuse.

### Mobile

- Form validation on login/register/create-tenant/join-tenant screens (email format, min lengths, required fields).
- Disable submit until forms are valid.
- Show field-level errors from backend (`zod` formatter).
- Add global offline banner using `@react-native-community/netinfo`.
- Clear TanStack Query cache on logout/tenant switch.
- Add loading/disabled states to all async buttons.
- Add simple error boundary around `AppNavigator`.
- Add a few mobile unit tests for stores and utilities.

## Track 2 — Corporate VPN

### Architecture

```
┌─────────────────────────────────────────┐
│  Mobile device                          │
│  (react-native-wireguard-vpn tunnel)    │
└──────────────┬──────────────────────────┘
               │ WireGuard UDP
               ▼
┌─────────────────────────────────────────┐
│  WireGuard container (wg-easy)          │
│  NAT + forwarding to API/network        │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│  pulse-chat API                         │
│  /vpn/config — peer config delivery     │
└─────────────────────────────────────────┘
```

### Backend / data model

Add `VpnPeer` model:

```prisma
model VpnPeer {
  id            String   @id @default(uuid())
  userId        String   @unique
  tenantId      String
  privateKey    String
  publicKey     String   @unique
  allowedIps    String   @default("10.200.0.0/24") // comma-separated
  address       String   @default("10.200.0.2/32")
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)
  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)
}
```

- `POST /vpn/config` — idempotent: creates or returns existing peer for the active tenant. Calls `wg` via `wg-easy` HTTP API or a small peer-management script.
- `DELETE /vpn/config` — removes peer.
- `GET /vpn/status` — returns peer info and server public endpoint.

Server public key, endpoint, DNS, MTU are read from environment variables.

### WireGuard service

Add `wireguard` service to `docker-compose.yml` using `wg-easy/wg-easy` image:
- Exposes WireGuard UDP port `51820`.
- Web UI / API on internal network only (accessible from API container).
- API container gets `WG_API_URL` env var to manage peers.

### Mobile

- Install `react-native-wireguard-vpn` and add Expo config plugin.
- Create `VpnStore` (Zustand) for `status`, `config`, `loading`, `error`.
- Create `VpnContext` / hook wrapping the native module.
- Add VPN toggle/card to `ProfileScreen`:
  - status: disconnected / connecting / connected / error,
  - connect button fetches config and calls `WireGuardVpnModule.connect(config)`,
  - disconnect button.
- Add `VpnScreen` with detailed status, endpoint, public key, last error.
- Add i18n keys for VPN states and actions.

### Native prerequisites (documented, manual)

- iOS: paid Apple Developer account, Network Extension / Packet Tunnel capability, manual Packet Tunnel extension target, matching bundle ID.
- Android: `BIND_VPN_SERVICE`, foreground service permissions.
- Expo: development build / EAS Build required; Expo Go is not supported.

## Security notes for MVP

- Server generates and stores private keys. This is acceptable for a pet project but must be replaced with client-side key generation before any real deployment.
- WireGuard config is delivered over authenticated HTTPS.
- Peer `allowedIps` defaults to `0.0.0.0/0, ::/0` for full-device tunnel; configurable per tenant later.

## Success criteria

- `pnpm test` passes in `services/api` with new edge-case tests.
- `apps/mobile` TypeScript check passes.
- Backend can create/list/remove WireGuard peers through `wg-easy` API.
- Mobile VPN store and UI compile; native module integration is wired (actual tunnel requires dev build on device).
