import { api } from './client';
import type { TenantMembership } from '@pulse-chat/shared';

export function listMyTenants() {
  return api.get<TenantMembership[]>('/tenants').then((r) => r.data);
}

export function createTenant(name: string) {
  return api.post<TenantMembership>('/tenants', { name }).then((r) => r.data);
}

export function joinTenant(code: string) {
  return api.post<TenantMembership>('/tenants/join', { code }).then((r) => r.data);
}

export function createInvite(tenantId: string) {
  return api.post<{ code: string }>(`/tenants/${tenantId}/invites`).then((r) => r.data);
}
