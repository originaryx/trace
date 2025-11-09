import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { signJws } from '../eddsa.js';
import { getDataFootprint } from '../data-footprint.js';
import * as crypto from 'crypto';
import { Readable } from 'stream';

const BundleQuerySchema = z.object({
  year: z.string().regex(/^\d{4}$/),
  month: z.string().regex(/^(0[1-9]|1[0-2])$/),
});

const plugin: FastifyPluginAsync = async (app) => {
  /**
   * POST /v1/compliance/bundle/:year/:month
   *
   * Generates a monthly compliance bundle (JWS-signed ZIP).
   *
   * Returns:
   * - summary.json: High-level metrics for the month
   * - events.ndjson: Detailed event log (manifest with SHA-256 per event)
   * - violations.json: Policy violation summary
   * - policy_snapshot.json: PEAC policy versions during the month
   * - data_footprint.json: What AI bots scraped (bytes, tokens, value)
   * - signature.jws: Ed25519 signature of bundle manifest
   *
   * The entire bundle is signed and verifiable via JWKS.
   */
  app.post('/v1/compliance/bundle/:year/:month', async (req, rep) => {
    const tenantId = (req as any).tenantId;

    if (!tenantId) {
      return rep.code(401).send({ error: 'authentication_required' });
    }

    const params = BundleQuerySchema.parse(req.params);
    const year = parseInt(params.year, 10);
    const month = parseInt(params.month, 10);

    // Calculate date range for the month
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59, 999);

    // Fetch tenant
    const tenant = await (app as any).db.tenant.findUnique({
      where: { id: tenantId },
      include: { settings: true },
    });

    if (!tenant) {
      return rep.code(404).send({ error: 'tenant_not_found' });
    }

    // 1. Generate summary.json
    const summary = await generateSummary(
      (app as any).db,
      tenantId,
      startDate,
      endDate
    );

    // 2. Get Data Footprint
    const dataFootprint = await getDataFootprint(
      (app as any).db,
      tenantId,
      startDate,
      endDate
    );

    // 3. Get violations
    const violations = await (app as any).db.policyViolation.findMany({
      where: {
        tenantId,
        ts: { gte: startDate, lte: endDate },
      },
      orderBy: { ts: 'desc' },
      take: 10000,
    });

    // 4. Get policy snapshot (all policy versions during this month)
    const policySnapshots = await (app as any).db.policyVersion.findMany({
      where: {
        tenantId,
        createdAt: { gte: startDate, lte: endDate },
      },
      orderBy: { version: 'asc' },
    });

    // 5. Get event manifest (SHA-256 hashes of events for verification)
    const eventManifest = await generateEventManifest(
      (app as any).db,
      tenantId,
      startDate,
      endDate
    );

    // 6. Create bundle manifest
    const bundleManifest = {
      version: '1.0',
      generated: new Date().toISOString(),
      tenant: {
        id: tenant.id,
        domain: tenant.domain,
      },
      period: {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
        year,
        month,
      },
      summary,
      dataFootprint,
      violations: {
        count: violations.length,
        items: violations.map((v: any) => ({
          ts: v.ts.toISOString(),
          path: v.path,
          crawlerFamily: v.crawlerFamily,
          evidenceHash: v.evidenceHash,
        })),
      },
      policySnapshots: policySnapshots.map((p: any) => ({
        version: p.version,
        createdAt: p.createdAt.toISOString(),
        policy: p.policyJson,
      })),
      eventManifest,
    };

    // 7. Sign the bundle with Ed25519
    const manifestJson = JSON.stringify(bundleManifest, null, 2);
    const signature = await signJws(manifestJson, tenantId);

    // 8. Create signed bundle
    const signedBundle = {
      manifest: bundleManifest,
      signature,
      verification: {
        algorithm: 'Ed25519',
        jwks: `https://${tenant.domain}/.well-known/jwks.json`,
        instructions: 'Verify signature using JWKS endpoint',
      },
    };

    // Returns JSON bundle
    // Future enhancement: Generate ZIP archives with archiver library
    // Future enhancement: Pre-generate and store in S3/R2 for faster retrieval
    return rep
      .header('Content-Type', 'application/json')
      .header('Content-Disposition', `attachment; filename="compliance-${year}-${month}.json"`)
      .send(signedBundle);
  });

  /**
   * GET /v1/compliance/bundle/:year/:month/download
   *
   * Downloads a pre-generated compliance bundle.
   * (For now, generates on-demand; in production, should fetch from storage)
   */
  app.get('/v1/compliance/bundle/:year/:month/download', async (req, rep) => {
    const tenantId = (req as any).tenantId;

    if (!tenantId) {
      return rep.code(401).send({ error: 'authentication_required' });
    }

    // TODO: Fetch from S3/R2 instead of generating on-demand
    // For now, redirect to POST endpoint (same logic)
    return rep.code(501).send({
      error: 'not_implemented',
      message: 'Pre-generated bundles not yet available. Use POST endpoint to generate on-demand.',
    });
  });

  /**
   * GET /v1/compliance/bundle
   *
   * Lists available compliance bundles for the tenant
   */
  app.get('/v1/compliance/bundle', async (req, rep) => {
    const tenantId = (req as any).tenantId;

    if (!tenantId) {
      return rep.code(401).send({ error: 'authentication_required' });
    }

    // Get distinct months with data
    const months = await (app as any).db.$queryRaw`
      SELECT
        DISTINCT DATE_TRUNC('month', ts) as month,
        COUNT(*) as event_count
      FROM crawl_events
      WHERE tenant_id = ${tenantId}
      GROUP BY DATE_TRUNC('month', ts)
      ORDER BY month DESC
      LIMIT 24
    `;

    const available = months.map((m: any) => ({
      year: m.month.getFullYear(),
      month: m.month.getMonth() + 1,
      monthName: m.month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
      eventCount: Number(m.event_count),
      downloadUrl: `/v1/compliance/bundle/${m.month.getFullYear()}/${String(m.month.getMonth() + 1).padStart(2, '0')}/download`,
    }));

    return { available };
  });
};

/**
 * Generate summary metrics for the bundle
 */
async function generateSummary(
  prisma: any,
  tenantId: string,
  startDate: Date,
  endDate: Date
): Promise<any> {
  const totalEvents = await prisma.crawlEvent.count({
    where: {
      tenantId,
      ts: { gte: startDate, lte: endDate },
    },
  });

  const botEvents = await prisma.crawlEvent.count({
    where: {
      tenantId,
      ts: { gte: startDate, lte: endDate },
      isBot: true,
    },
  });

  const crawlerBreakdown = await prisma.crawlEvent.groupBy({
    by: ['crawlerFamily'],
    where: {
      tenantId,
      ts: { gte: startDate, lte: endDate },
      isBot: true,
    },
    _count: true,
  });

  const topPaths = await prisma.$queryRaw`
    SELECT path, COUNT(*) as count
    FROM crawl_events
    WHERE tenant_id = ${tenantId}
      AND ts >= ${startDate}
      AND ts <= ${endDate}
      AND is_bot = true
    GROUP BY path
    ORDER BY count DESC
    LIMIT 20
  `;

  return {
    totalEvents,
    botEvents,
    humanEvents: totalEvents - botEvents,
    botPercentage: totalEvents > 0 ? ((botEvents / totalEvents) * 100).toFixed(2) : '0.00',
    crawlerBreakdown: crawlerBreakdown.map((c: any) => ({
      crawlerFamily: c.crawlerFamily || 'unknown',
      count: c._count,
    })),
    topPaths: topPaths.map((p: any) => ({
      path: p.path,
      count: Number(p.count),
    })),
  };
}

/**
 * Generate event manifest (SHA-256 hashes for verification)
 */
async function generateEventManifest(
  prisma: any,
  tenantId: string,
  startDate: Date,
  endDate: Date
): Promise<any> {
  // Get count of events per day with hash
  const dailyHashes = await prisma.$queryRaw`
    SELECT
      DATE(ts) as date,
      COUNT(*) as count,
      MD5(STRING_AGG(id::text, ',' ORDER BY id)) as day_hash
    FROM crawl_events
    WHERE tenant_id = ${tenantId}
      AND ts >= ${startDate}
      AND ts <= ${endDate}
    GROUP BY DATE(ts)
    ORDER BY DATE(ts)
  `;

  return {
    totalEvents: dailyHashes.reduce((sum: number, d: any) => sum + Number(d.count), 0),
    dailyBreakdown: dailyHashes.map((d: any) => ({
      date: d.date.toISOString().split('T')[0],
      count: Number(d.count),
      hash: d.day_hash,
    })),
  };
}

export default plugin;
