// This module is a placeholder until react-native-wireguard-vpn is installed
// and linked via an Expo dev build / EAS Build.

export interface NativeVpnModule {
  connect(config: string, name: string): Promise<void>;
  disconnect(): Promise<void>;
  getStatus(): Promise<{ connected: boolean }>;
}

export async function connectVpn(_config: string, _name: string): Promise<void> {
  throw new Error('Native VPN module is not available in Expo Go. Build a dev client.');
}

export async function disconnectVpn(): Promise<void> {
  throw new Error('Native VPN module is not available in Expo Go. Build a dev client.');
}
