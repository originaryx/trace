/**
 * Resource Tracker
 *
 * Manages the resources table for Data Footprint tracking.
 * Deduplicates content by SHA-256 hash and tracks access patterns.
 */

import { PrismaClient } from '@prisma/client';
import { estimateTokens } from './data-footprint.js';

/**
 * Update or create a resource entry
 * Called when processing events with resource_hash
 */
export async function trackResource(
  prisma: PrismaClient,
  tenantId: string,
  host: string,
  path: string,
  contentHash: string,
  contentType: string | null,
  contentLength: number,
  isBot: boolean
): Promise<void> {
  // Calculate estimated tokens
  const estimatedTokens = contentType ? estimateTokens(contentType, contentLength) : null;

  // Upsert resource
  try {
    await prisma.resource.upsert({
      where: {
        tenantId_host_path_contentHash: {
          tenantId,
          host,
          path,
          contentHash,
        },
      },
      update: {
        lastSeenAt: new Date(),
        accessCount: { increment: 1 },
        botAccessCount: isBot ? { increment: 1 } : undefined,
      },
      create: {
        tenantId,
        host,
        path,
        contentHash,
        contentType,
        contentLength,
        estimatedTokens,
        accessCount: 1,
        botAccessCount: isBot ? 1 : 0,
      },
    });
  } catch (error) {
    // Log error but don't fail the request
    console.error('Failed to track resource:', error);
  }
}

/**
 * Batch track resources from events
 * More efficient for processing large batches
 */
export async function batchTrackResources(
  prisma: PrismaClient,
  events: {
    tenantId: string;
    host: string;
    path: string;
    resourceHash: string | null;
    contentType: string | null;
    responseBytes: number | null;
    isBot: boolean | null;
  }[]
): Promise<void> {
  // Filter events with resource data
  const resourceEvents = events.filter(
    (e) => e.resourceHash && e.responseBytes && e.responseBytes > 0
  );

  if (resourceEvents.length === 0) {
    return;
  }

  // Group by unique resource (tenant + host + path + hash)
  const resourceMap = new Map<string, typeof resourceEvents[0]>();

  for (const event of resourceEvents) {
    const key = `${event.tenantId}:${event.host}:${event.path}:${event.resourceHash}`;

    if (!resourceMap.has(key)) {
      resourceMap.set(key, event);
    }
  }

  // Update each unique resource
  const promises = Array.from(resourceMap.values()).map((event) =>
    trackResource(
      prisma,
      event.tenantId,
      event.host,
      event.path,
      event.resourceHash!,
      event.contentType,
      event.responseBytes!,
      event.isBot ?? false
    )
  );

  await Promise.allSettled(promises);
}

/**
 * Prune old resources
 * Call this periodically to clean up resources not seen in N days
 */
export async function pruneOldResources(
  prisma: PrismaClient,
  tenantId: string,
  daysOld: number = 90
): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);

  const result = await prisma.resource.deleteMany({
    where: {
      tenantId,
      lastSeenAt: { lt: cutoffDate },
    },
  });

  return result.count;
}

/**
 * Get resource stats for a tenant
 */
export async function getResourceStats(
  prisma: PrismaClient,
  tenantId: string
): Promise<{
  totalResources: number;
  totalBytes: number;
  totalTokens: number;
  botAccessedResources: number;
  avgBytesPerResource: number;
}> {
  const stats = await prisma.resource.aggregate({
    where: { tenantId },
    _count: { id: true },
    _sum: {
      contentLength: true,
      estimatedTokens: true,
    },
  });

  const botAccessedCount = await prisma.resource.count({
    where: {
      tenantId,
      botAccessCount: { gt: 0 },
    },
  });

  const totalResources = stats._count.id;
  const totalBytes = stats._sum.contentLength || 0;
  const totalTokens = stats._sum.estimatedTokens || 0;

  return {
    totalResources,
    totalBytes,
    totalTokens,
    botAccessedResources: botAccessedCount,
    avgBytesPerResource: totalResources > 0 ? Math.round(totalBytes / totalResources) : 0,
  };
}
