import { PrismaClient, Tenant } from '@prisma/client';
import type { FastifyRequest } from 'fastify';

const prisma = new PrismaClient();

/**
 * Extract and validate tenant from request
 * Supports multiple auth methods:
 * 1. X-Tenant-Domain header
 * 2. ?tenant=domain query parameter
 * 3. tenantId from API key auth (set by events route)
 */
export async function mustTenant(req: FastifyRequest): Promise<Tenant> {
  // Try header first
  const headerDomain = req.headers['x-tenant-domain']?.toString().trim();
  if (headerDomain) {
    const tenant = await prisma.tenant.findFirst({
      where: { domain: headerDomain },
    });
    if (tenant) return tenant;
  }

  // Try query parameter
  const queryDomain = (req.query as any)?.tenant?.toString().trim();
  if (queryDomain) {
    const tenant = await prisma.tenant.findFirst({
      where: { domain: queryDomain },
    });
    if (tenant) return tenant;
  }

  // Try tenantId from API key auth
  const tenantId = (req as any).tenantId as string | undefined;
  if (tenantId) {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
    });
    if (tenant) return tenant;
  }

  throw new Error('unauthorized: tenant not found');
}

/**
 * Get tenant by domain (used in public routes)
 */
export async function getTenantByDomain(domain: string): Promise<Tenant | null> {
  return prisma.tenant.findFirst({
    where: { domain },
  });
}
