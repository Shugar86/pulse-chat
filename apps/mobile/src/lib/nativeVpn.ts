import { NativeModules } from 'react-native';

const WireguardVpn = NativeModules.WireguardVpn;

export async function connectVpn(config: string, name: string): Promise<void> {
  if (!WireguardVpn) {
    throw new Error('Native VPN module is not available in Expo Go. Build a dev client.');
  }
  return WireguardVpn.connect(config, name);
}

export async function disconnectVpn(): Promise<void> {
  if (!WireguardVpn) {
    throw new Error('Native VPN module is not available in Expo Go. Build a dev client.');
  }
  return WireguardVpn.disconnect();
}

export async function getVpnStatus(): Promise<{ connected: boolean }> {
  if (!WireguardVpn) return { connected: false };
  return WireguardVpn.getStatus();
}
