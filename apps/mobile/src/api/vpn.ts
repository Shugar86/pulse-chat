import { api } from './client';

export interface VpnConfig {
  id: string;
  address: string;
  publicKey: string; // server public key
  endpoint: string;
  dns: string;
  allowedIps: string;
  config: string; // client config without PrivateKey
}

export function getVpnConfig() {
  return api.get<VpnConfig>('/vpn/config').then((r) => r.data);
}

export function createVpnConfig(clientPublicKey: string) {
  return api.post<VpnConfig>('/vpn/config', { publicKey: clientPublicKey }).then((r) => r.data);
}

export function deleteVpnConfig() {
  return api.delete('/vpn/config').then((r) => r.data);
}
