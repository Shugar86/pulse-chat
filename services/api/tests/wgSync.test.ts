import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { writePeerManifest, removePeerManifest } from '../src/lib/wgSync';

describe('wgSync', () => {
  let syncDir: string;

  beforeEach(() => {
    syncDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wg-sync-'));
    process.env.WG_SYNC_DIR = syncDir;
  });

  afterEach(() => {
    fs.rmSync(syncDir, { recursive: true, force: true });
    delete process.env.WG_SYNC_DIR;
  });

  it('writes a peer manifest', () => {
    writePeerManifest({
      id: 'peer-1',
      tenantId: 'tenant-1',
      userId: 'user-1',
      publicKey: 'pubkey',
      address: '10.200.0.2/32',
      allowedIps: '0.0.0.0/0',
    });
    const filePath = path.join(syncDir, 'tenant-1', 'user-1.json');
    expect(fs.existsSync(filePath)).toBe(true);
    const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    expect(content.publicKey).toBe('pubkey');
    expect(content.address).toBe('10.200.0.2/32');
  });

  it('removes a peer manifest', () => {
    writePeerManifest({
      id: 'peer-1',
      tenantId: 'tenant-1',
      userId: 'user-1',
      publicKey: 'pubkey',
      address: '10.200.0.2/32',
      allowedIps: '0.0.0.0/0',
    });
    removePeerManifest('tenant-1', 'user-1');
    const filePath = path.join(syncDir, 'tenant-1', 'user-1.json');
    expect(fs.existsSync(filePath)).toBe(false);
  });
});
