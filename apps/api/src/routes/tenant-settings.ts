import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

const plugin: FastifyPluginAsync = async (app) => {
  /**
   * DELETE /v1/settings/data
   *
   * Delete all event data for the tenant (GDPR compliance).
   * This is a destructive operation and cannot be undone.
   */
  app.delete('/settings/data', async (req, rep) => {
    const tenantId = (req as any).tenantId;

    if (!tenantId) {
      return rep.code(401).send({ error: 'authentication_required' });
    }

    // Verify tenant exists
    const tenant = await (app as any).db.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) {
      return rep.code(404).send({ error: 'tenant_not_found' });
    }

    try {
      // Delete all crawl events
      const eventsDeleted = await (app as any).db.crawlEvent.deleteMany({
        where: { tenantId },
      });

      // Delete all resources
      const resourcesDeleted = await (app as any).db.resource.deleteMany({
        where: { tenantId },
      });

      req.log.info(
        {
          tenantId,
          eventsDeleted: eventsDeleted.count,
          resourcesDeleted: resourcesDeleted.count,
        },
        'Tenant data deleted'
      );

      return rep.send({
        success: true,
        message: 'All event data has been permanently deleted',
        deleted: {
          events: eventsDeleted.count,
          resources: resourcesDeleted.count,
        },
      });
    } catch (error) {
      req.log.error({ error, tenantId }, 'Failed to delete tenant data');
      return rep.code(500).send({ error: 'deletion_failed' });
    }
  });

  /**
   * GET /v1/settings/retention
   *
   * Get current data retention settings for the tenant.
   */
  app.get('/settings/retention', async (req, rep) => {
    const tenantId = (req as any).tenantId;

    if (!tenantId) {
      return rep.code(401).send({ error: 'authentication_required' });
    }

    const tenant = await (app as any).db.tenant.findUnique({
      where: { id: tenantId },
      include: { settings: true },
    });

    if (!tenant) {
      return rep.code(404).send({ error: 'tenant_not_found' });
    }

    // Get oldest event to calculate current retention
    const oldestEvent = await (app as any).db.crawlEvent.findFirst({
      where: { tenantId },
      orderBy: { ts: 'asc' },
      select: { ts: true },
    });

    const now = new Date();
    const retentionDays = oldestEvent
      ? Math.floor((now.getTime() - oldestEvent.ts.getTime()) / (1000 * 60 * 60 * 24))
      : 0;

    return rep.send({
      retentionDays,
      oldestEvent: oldestEvent?.ts,
      plan: tenant.plan || 'free',
      maxRetentionDays: tenant.plan === 'enterprise' ? null : tenant.plan === 'pro' ? 180 : 30,
    });
  });

  /**
   * POST /v1/settings/retention/prune
   *
   * Manually prune events older than specified days.
   * Useful for testing or adjusting retention.
   */
  app.post('/settings/retention/prune', async (req, rep) => {
    const tenantId = (req as any).tenantId;

    if (!tenantId) {
      return rep.code(401).send({ error: 'authentication_required' });
    }

    const PruneSchema = z.object({
      olderThanDays: z.number().int().min(1).max(365),
    });

    const body = PruneSchema.parse(req.body);

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - body.olderThanDays);

    try {
      // Delete old events
      const eventsDeleted = await (app as any).db.crawlEvent.deleteMany({
        where: {
          tenantId,
          ts: { lt: cutoffDate },
        },
      });

      // Delete old resources (not seen in retention period)
      const resourcesDeleted = await (app as any).db.resource.deleteMany({
        where: {
          tenantId,
          lastSeenAt: { lt: cutoffDate },
        },
      });

      req.log.info(
        {
          tenantId,
          olderThanDays: body.olderThanDays,
          cutoffDate,
          eventsDeleted: eventsDeleted.count,
          resourcesDeleted: resourcesDeleted.count,
        },
        'Data pruned'
      );

      return rep.send({
        success: true,
        message: `Data older than ${body.olderThanDays} days has been deleted`,
        cutoffDate,
        deleted: {
          events: eventsDeleted.count,
          resources: resourcesDeleted.count,
        },
      });
    } catch (error) {
      req.log.error({ error, tenantId }, 'Failed to prune data');
      return rep.code(500).send({ error: 'prune_failed' });
    }
  });
};

export default plugin;
