import { api } from './client';

export interface VpnConfig {
  id: string;
  address: string;
  publicKey: string;
  endpoint: string;
  dns: string;
  allowedIps: string;
  config: string;
}

export function getVpnConfig() {
  return api.get<VpnConfig>('/vpn/config').then((r) => r.data);
}

export function createVpnConfig() {
  return api.post<VpnConfig>('/vpn/config').then((r) => r.data);
}

export function deleteVpnConfig() {
  return api.delete('/vpn/config').then((r) => r.data);
}
