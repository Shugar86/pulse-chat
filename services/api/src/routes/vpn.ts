import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { requireTenant, TenantRequest } from '../middleware/tenant.js';
import { ApiError } from '../middleware/error.js';
import { config } from '../config.js';
import { allocateAddress, generateClientConfig } from '../lib/wireguard.js';
import { parseOrThrow } from '../lib/validation.js';
import { writePeerManifest, removePeerManifest } from '../lib/wgSync.js';

export const vpnRouter: Router = Router();

const createVpnSchema = z.object({ publicKey: z.string().min(1) });

vpnRouter.use(requireAuth, requireTenant);

function assertWgConfigured() {
  if (!config.wg.serverPublicKey || !config.wg.endpoint) {
    throw new ApiError(503, 'VPN server is not configured');
  }
}

function buildVpnResponse(peer: { id: string; address: string; publicKey: string; dns: string; allowedIps: string }) {
  const conf = generateClientConfig({
    address: peer.address,
    dns: peer.dns,
    serverPublicKey: config.wg.serverPublicKey,
    allowedIps: peer.allowedIps,
    endpoint: config.wg.endpoint,
  });

  return {
    id: peer.id,
    address: peer.address,
    publicKey: peer.publicKey,
    endpoint: config.wg.endpoint,
    dns: peer.dns,
    allowedIps: peer.allowedIps,
    config: conf,
  };
}

vpnRouter.get('/config', async (req: TenantRequest, res, next) => {
  try {
    assertWgConfigured();
    const peer = await prisma.vpnPeer.findUnique({
      where: { userId: req.user!.userId },
    });
    if (!peer) throw new ApiError(404, 'VPN peer not found');
    if (peer.tenantId !== req.tenantId) throw new ApiError(403, 'Peer belongs to another tenant');

    res.json(buildVpnResponse(peer));
  } catch (err) {
    next(err);
  }
});

vpnRouter.post('/config', async (req: TenantRequest, res, next) => {
  try {
    assertWgConfigured();
    const { publicKey } = parseOrThrow(createVpnSchema, req.body);
    const existing = await prisma.vpnPeer.findUnique({
      where: { userId: req.user!.userId },
    });
    if (existing) {
      if (existing.tenantId !== req.tenantId) throw new ApiError(403, 'Peer belongs to another tenant');
      return res.json(buildVpnResponse(existing));
    }

    const address = await allocateAddress(req.tenantId!, config.wg.network);
    const peer = await prisma.vpnPeer.create({
      data: {
        userId: req.user!.userId,
        tenantId: req.tenantId!,
        publicKey,
        address,
        dns: config.wg.dns,
        allowedIps: config.wg.allowedIps,
      },
    });

    writePeerManifest({
      id: peer.id,
      tenantId: peer.tenantId,
      userId: peer.userId,
      publicKey: peer.publicKey,
      address: peer.address,
      allowedIps: peer.allowedIps,
    });

    res.status(201).json(buildVpnResponse(peer));
  } catch (err) {
    next(err);
  }
});

vpnRouter.delete('/config', async (req: TenantRequest, res, next) => {
  try {
    const peer = await prisma.vpnPeer.findUnique({
      where: { userId: req.user!.userId },
    });
    if (!peer) throw new ApiError(404, 'VPN peer not found');
    if (peer.tenantId !== req.tenantId) throw new ApiError(403, 'Peer belongs to another tenant');
    await prisma.vpnPeer.delete({ where: { id: peer.id } });
    removePeerManifest(peer.tenantId, peer.userId);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});
