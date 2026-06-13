import { generateKeyPair, allocateAddress, generateClientConfig } from '../src/lib/wireguard';
import { prisma } from '../src/lib/prisma';

describe('wireguard library', () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('generates a valid key pair', () => {
    const keys = generateKeyPair();
    expect(keys.privateKey).toBeDefined();
    expect(keys.publicKey).toBeDefined();
    expect(Buffer.from(keys.privateKey, 'base64').length).toBe(32);
    expect(Buffer.from(keys.publicKey, 'base64').length).toBe(32);
  });

  it('allocates sequential addresses inside the tenant network', async () => {
    await prisma.vpnPeer.deleteMany();
    const address = await allocateAddress('tenant-1', '10.200.0.0/24');
    expect(address).toBe('10.200.0.2/32');
  });

  it('renders a WireGuard client config', () => {
    const conf = generateClientConfig({
      privateKey: 'aGVsbG8=',
      address: '10.200.0.2/32',
      dns: '1.1.1.1',
      serverPublicKey: 'c2VydmVyLWtleQ==',
      allowedIps: '0.0.0.0/0',
      endpoint: 'vpn.example.com:51820',
    });
    expect(conf).toContain('[Interface]');
    expect(conf).toContain('[Peer]');
    expect(conf).toContain('PrivateKey = aGVsbG8=');
    expect(conf).toContain('Endpoint = vpn.example.com:51820');
  });
});
