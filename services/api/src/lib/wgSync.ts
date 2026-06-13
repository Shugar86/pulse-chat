import fs from 'node:fs';
import path from 'node:path';

export interface PeerManifest {
  id: string;
  tenantId: string;
  userId: string;
  publicKey: string;
  address: string;
  allowedIps: string;
}

function getSyncDir(): string {
  const dir = process.env.WG_SYNC_DIR;
  if (!dir) throw new Error('WG_SYNC_DIR is not configured');
  return dir;
}

export function writePeerManifest(peer: PeerManifest): void {
  const syncDir = getSyncDir();
  const tenantDir = path.join(syncDir, peer.tenantId);
  fs.mkdirSync(tenantDir, { recursive: true });
  const filePath = path.join(tenantDir, `${peer.userId}.json`);
  fs.writeFileSync(filePath, JSON.stringify(peer, null, 2));
}

export function removePeerManifest(tenantId: string, userId: string): void {
  const syncDir = getSyncDir();
  const filePath = path.join(syncDir, tenantId, `${userId}.json`);
  if (fs.existsSync(filePath)) {
    fs.rmSync(filePath);
  }
}
