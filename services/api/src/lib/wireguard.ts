import * as nacl from 'tweetnacl';
import { prisma } from './prisma.js';

export interface KeyPair {
  privateKey: string;
  publicKey: string;
}

export function generateKeyPair(): KeyPair {
  const pair = nacl.box.keyPair();
  return {
    privateKey: Buffer.from(pair.secretKey).toString('base64'),
    publicKey: Buffer.from(pair.publicKey).toString('base64'),
  };
}

export async function allocateAddress(tenantId: string, network: string): Promise<string> {
  const prefix = network.replace(/\.0\/\d+$/, '');
  const count = await prisma.vpnPeer.count({ where: { tenantId } });
  const lastOctet = count + 2;
  return `${prefix}.${lastOctet}/32`;
}

export interface VpnConfigInput {
  privateKey?: string;
  address: string;
  dns: string;
  serverPublicKey: string;
  allowedIps: string;
  endpoint: string;
}

export function generateClientConfig(input: VpnConfigInput): string {
  const interfaceLines: string[] = ['[Interface]'];
  if (input.privateKey) {
    interfaceLines.push(`PrivateKey = ${input.privateKey}`);
  }
  interfaceLines.push(`Address = ${input.address}`, `DNS = ${input.dns}`, '');

  return interfaceLines.concat([
    '[Peer]',
    `PublicKey = ${input.serverPublicKey}`,
    `AllowedIPs = ${input.allowedIps}`,
    `Endpoint = ${input.endpoint}`,
    'PersistentKeepalive = 25',
    '',
  ]).join('\n');
}
