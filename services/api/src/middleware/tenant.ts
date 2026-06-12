import { Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma.js';
import { AuthRequest } from './auth.js';
import { ApiError } from './error.js';

export interface TenantRequest extends AuthRequest {
  tenantId?: string;
}

export async function requireTenant(req: TenantRequest, res: Response, next: NextFunction) {
  try {
    const tenantId = req.headers['x-tenant-id'] as string | undefined;
    if (!tenantId) throw new ApiError(400, 'Tenant id required');

    const membership = await prisma.tenantMembership.findUnique({
      where: { tenantId_userId: { tenantId, userId: req.user!.userId } },
    });
    if (!membership) throw new ApiError(403, 'Not a tenant member');

    req.tenantId = tenantId;
    return next();
  } catch (err) {
    return next(err);
  }
}
