import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { getDataFootprint, formatBytes, formatCurrency, formatTokens } from '../data-footprint.js';

const QuerySchema = z.object({
  start: z.string().datetime().optional(),
  end: z.string().datetime().optional(),
  period: z.enum(['day', 'week', 'month', 'quarter', 'year']).optional(),
});

const plugin: FastifyPluginAsync = async (app) => {
  /**
   * GET /v1/data-footprint
   *
   * Returns Data Footprint metrics showing how much data AI bots have scraped.
   *
   * Query params:
   * - start: ISO datetime (default: 30 days ago)
   * - end: ISO datetime (default: now)
   * - period: 'day' | 'week' | 'month' (default: 'month')
   *
   * Returns:
   * - Transport volume (bytes served)
   * - Unique content (deduplicated)
   * - Semantic tokens (estimated)
   * - Estimated value
   * - Per-crawler breakdown
   * - Top resources
   */
  app.get('/v1/data-footprint', async (req, rep) => {
    // Tenant authentication via API key
    // Future: Support session-based auth for dashboard
    const tenantId = (req as any).tenantId;

    if (!tenantId) {
      return rep.code(401).send({ error: 'authentication_required' });
    }

    const query = QuerySchema.parse(req.query);

    // Calculate date range
    const endDate = query.end ? new Date(query.end) : new Date();
    let startDate: Date;

    if (query.start) {
      startDate = new Date(query.start);
    } else {
      // Default based on period
      const period = query.period || 'month';
      startDate = new Date(endDate);

      switch (period) {
        case 'day':
          startDate.setDate(startDate.getDate() - 1);
          break;
        case 'week':
          startDate.setDate(startDate.getDate() - 7);
          break;
        case 'month':
          startDate.setMonth(startDate.getMonth() - 1);
          break;
        case 'quarter':
          startDate.setMonth(startDate.getMonth() - 3);
          break;
        case 'year':
          startDate.setFullYear(startDate.getFullYear() - 1);
          break;
      }
    }

    // Get metrics
    const metrics = await getDataFootprint((app as any).db, tenantId, startDate, endDate);

    // Format response
    return {
      period: {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
      },
      summary: {
        totalBytes: metrics.totalBytes,
        totalBytesFormatted: formatBytes(metrics.totalBytes),
        totalRequests: metrics.totalRequests,
        uniqueResources: metrics.uniqueResources,
        uniqueBytes: metrics.uniqueBytes,
        uniqueBytesFormatted: formatBytes(metrics.uniqueBytes),
        estimatedTokens: metrics.estimatedTokens,
        estimatedTokensFormatted: formatTokens(metrics.estimatedTokens),
        estimatedValue: metrics.estimatedValue,
        estimatedValueFormatted: formatCurrency(metrics.estimatedValue),
      },
      byCrawler: metrics.byCrawler.map((c) => ({
        ...c,
        bytesFormatted: formatBytes(c.bytes),
        estimatedTokensFormatted: formatTokens(c.estimatedTokens),
        estimatedValueFormatted: formatCurrency(c.estimatedValue),
      })),
      topResources: metrics.topResources.map((r) => ({
        ...r,
        bytesFormatted: formatBytes(r.bytes),
        estimatedTokensFormatted: formatTokens(r.estimatedTokens),
      })),
    };
  });

  /**
   * GET /v1/data-footprint/timeline
   *
   * Returns Data Footprint over time (time-series data for charts)
   */
  app.get('/v1/data-footprint/timeline', async (req, rep) => {
    const tenantId = (req as any).tenantId;

    if (!tenantId) {
      return rep.code(401).send({ error: 'authentication_required' });
    }

    const query = QuerySchema.parse(req.query);

    // Calculate date range
    const endDate = query.end ? new Date(query.end) : new Date();
    let startDate: Date;

    if (query.start) {
      startDate = new Date(query.start);
    } else {
      const period = query.period || 'month';
      startDate = new Date(endDate);

      switch (period) {
        case 'day':
          startDate.setDate(startDate.getDate() - 1);
          break;
        case 'week':
          startDate.setDate(startDate.getDate() - 7);
          break;
        case 'month':
          startDate.setMonth(startDate.getMonth() - 1);
          break;
        case 'quarter':
          startDate.setMonth(startDate.getMonth() - 3);
          break;
        case 'year':
          startDate.setFullYear(startDate.getFullYear() - 1);
          break;
      }
    }

    // Query time-series data
    // Group by day for timeline
    const timeline = await (app as any).db.$queryRaw`
      SELECT
        DATE(ts) as date,
        COUNT(*) as requests,
        SUM(response_bytes) as bytes,
        COUNT(DISTINCT resource_hash) as unique_resources
      FROM crawl_events
      WHERE
        tenant_id = ${tenantId}
        AND ts >= ${startDate}
        AND ts <= ${endDate}
        AND is_bot = true
        AND response_bytes IS NOT NULL
      GROUP BY DATE(ts)
      ORDER BY DATE(ts)
    `;

    // Format response
    return {
      period: {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
      },
      timeline: timeline.map((t: any) => ({
        date: t.date,
        requests: Number(t.requests),
        bytes: Number(t.bytes || 0),
        bytesFormatted: formatBytes(Number(t.bytes || 0)),
        uniqueResources: Number(t.unique_resources || 0),
      })),
    };
  });

  /**
   * GET /v1/data-footprint/crawler/:crawlerFamily
   *
   * Returns detailed Data Footprint for a specific crawler
   */
  app.get('/v1/data-footprint/crawler/:crawlerFamily', async (req, rep) => {
    const tenantId = (req as any).tenantId;

    if (!tenantId) {
      return rep.code(401).send({ error: 'authentication_required' });
    }

    const { crawlerFamily } = req.params as { crawlerFamily: string };
    const query = QuerySchema.parse(req.query);

    // Calculate date range
    const endDate = query.end ? new Date(query.end) : new Date();
    let startDate = query.start ? new Date(query.start) : new Date(endDate);

    if (!query.start) {
      startDate.setMonth(startDate.getMonth() - 1);
    }

    // Get events for this crawler
    const events = await (app as any).db.crawlEvent.findMany({
      where: {
        tenantId,
        ts: { gte: startDate, lte: endDate },
        crawlerFamily,
        isBot: true,
      },
      select: {
        ts: true,
        path: true,
        responseBytes: true,
        contentType: true,
        resourceHash: true,
      },
      orderBy: { ts: 'desc' },
      take: 1000,
    });

    const totalBytes = events.reduce((sum: number, e: any) => sum + (e.responseBytes || 0), 0);
    const totalRequests = events.length;
    const uniqueHashes = new Set(events.filter((e: any) => e.resourceHash).map((e: any) => e.resourceHash));

    // Get path distribution
    const pathMap = new Map<string, number>();
    for (const event of events) {
      pathMap.set(event.path, (pathMap.get(event.path) || 0) + 1);
    }

    const topPaths = Array.from(pathMap.entries())
      .map(([path, count]) => ({ path, requests: count }))
      .sort((a, b) => b.requests - a.requests)
      .slice(0, 20);

    return {
      crawlerFamily,
      period: {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
      },
      summary: {
        totalBytes,
        totalBytesFormatted: formatBytes(totalBytes),
        totalRequests,
        uniqueResources: uniqueHashes.size,
      },
      topPaths,
      recentEvents: events.slice(0, 100).map((e: any) => ({
        ts: e.ts.toISOString(),
        path: e.path,
        bytes: e.responseBytes || 0,
        bytesFormatted: formatBytes(e.responseBytes || 0),
        contentType: e.contentType || 'unknown',
      })),
    };
  });
};

export default plugin;
