import * as SecureStore from 'expo-secure-store';
import { VpnConfig } from '../api/vpn';

const VPN_PRIVATE_KEY_PREFIX = 'vpn_private_key_';

export async function saveVpnPrivateKey(peerId: string, privateKey: string): Promise<void> {
  await SecureStore.setItemAsync(`${VPN_PRIVATE_KEY_PREFIX}${peerId}`, privateKey);
}

export async function getVpnPrivateKey(peerId: string): Promise<string | null> {
  return SecureStore.getItemAsync(`${VPN_PRIVATE_KEY_PREFIX}${peerId}`);
}

export async function deleteVpnPrivateKey(peerId: string): Promise<void> {
  await SecureStore.deleteItemAsync(`${VPN_PRIVATE_KEY_PREFIX}${peerId}`);
}

export function buildWireGuardConfig(config: VpnConfig, privateKey: string): string {
  return `[Interface]
PrivateKey = ${privateKey}
Address = ${config.address}
DNS = ${config.dns}

[Peer]
PublicKey = ${config.publicKey}
AllowedIPs = ${config.allowedIps}
Endpoint = ${config.endpoint}
PersistentKeepalive = 25
`;
}
