import { FastifyPluginAsync } from 'fastify';

const plugin: FastifyPluginAsync = async (app) => {
  /**
   * GET /v1/public/badge/:domain.svg
   *
   * Public badge showing bot compliance status.
   * Used for transparency and PR value.
   */
  app.get('/public/badge/:domain.svg', async (req, rep) => {
    const { domain } = req.params as { domain: string };

    // Find tenant by domain
    const tenant = await (app as any).db.tenant.findFirst({
      where: { domain },
    });

    if (!tenant) {
      // Return "unconfigured" badge
      return rep
        .type('image/svg+xml')
        .header('Cache-Control', 'public, max-age=300')
        .send(generateBadgeSVG('not configured', 'gray'));
    }

    // Count recent violations (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const violations = await (app as any).db.crawlEvent.count({
      where: {
        tenantId: tenant.id,
        ts: { gte: thirtyDaysAgo },
        isBot: true,
        // Violation detection based on HTTP status codes
        // Future: Parse robots.txt and PEAC policy for more accurate detection
        status: { in: [401, 403] },
      },
    });

    const status = violations === 0 ? 'compliant' : `${violations} violations`;
    const color = violations === 0 ? 'green' : violations < 10 ? 'yellow' : 'red';

    return rep
      .type('image/svg+xml')
      .header('Cache-Control', 'public, max-age=300')
      .send(generateBadgeSVG(status, color));
  });

  /**
   * GET /v1/public/stats
   *
   * Public statistics for a domain.
   * Powers the badge and public transparency pages.
   */
  app.get('/public/stats', async (req, rep) => {
    const { domain } = req.query as { domain: string };

    if (!domain) {
      return rep.code(400).send({ error: 'domain_required' });
    }

    const tenant = await (app as any).db.tenant.findFirst({
      where: { domain },
    });

    if (!tenant) {
      return rep.code(404).send({ error: 'domain_not_found' });
    }

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Total requests
    const totalRequests = await (app as any).db.crawlEvent.count({
      where: {
        tenantId: tenant.id,
        ts: { gte: thirtyDaysAgo },
      },
    });

    // Bot requests
    const botRequests = await (app as any).db.crawlEvent.count({
      where: {
        tenantId: tenant.id,
        ts: { gte: thirtyDaysAgo },
        isBot: true,
      },
    });

    // Top crawlers
    const topCrawlers = await (app as any).db.crawlEvent.groupBy({
      by: ['crawlerFamily'],
      where: {
        tenantId: tenant.id,
        ts: { gte: thirtyDaysAgo },
        isBot: true,
        crawlerFamily: { not: null },
      },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 5,
    });

    // Violations
    const violations = await (app as any).db.crawlEvent.count({
      where: {
        tenantId: tenant.id,
        ts: { gte: thirtyDaysAgo },
        isBot: true,
        status: { in: [401, 403] },
      },
    });

    // Data Footprint summary
    const dataFootprint = await (app as any).db.resource.aggregate({
      where: {
        tenantId: tenant.id,
        botAccessCount: { gt: 0 },
      },
      _sum: {
        contentLength: true,
        estimatedTokens: true,
      },
      _count: { id: true },
    });

    const botTrafficPercent =
      totalRequests > 0 ? ((botRequests / totalRequests) * 100).toFixed(1) : '0.0';

    return rep
      .header('Cache-Control', 'public, max-age=300')
      .send({
        domain,
        period: '30d',
        botTraffic: `${botTrafficPercent}%`,
        totalRequests,
        botRequests,
        violations,
        topCrawlers: topCrawlers.map((c: any) => ({
          family: c.crawlerFamily,
          requests: c._count.id,
        })),
        dataFootprint: {
          uniqueResources: dataFootprint._count.id,
          totalBytes: dataFootprint._sum.contentLength || 0,
          estimatedTokens: dataFootprint._sum.estimatedTokens || 0,
          estimatedValue:
            ((dataFootprint._sum.estimatedTokens || 0) * 0.000001).toFixed(2) + ' USD',
        },
      });
  });
};

/**
 * Generate SVG badge
 */
function generateBadgeSVG(status: string, color: string): string {
  const colors: Record<string, string> = {
    green: '#4CAF50',
    yellow: '#FFC107',
    red: '#F44336',
    gray: '#9E9E9E',
  };

  const bgColor = colors[color] || colors.gray;
  const textWidth = status.length * 7 + 20;
  const totalWidth = 120 + textWidth;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="20" role="img">
  <title>Originary Trace: ${status}</title>
  <linearGradient id="s" x2="0" y2="100%">
    <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
    <stop offset="1" stop-opacity=".1"/>
  </linearGradient>
  <clipPath id="r">
    <rect width="${totalWidth}" height="20" rx="3" fill="#fff"/>
  </clipPath>
  <g clip-path="url(#r)">
    <rect width="120" height="20" fill="#555"/>
    <rect x="120" width="${textWidth}" height="20" fill="${bgColor}"/>
    <rect width="${totalWidth}" height="20" fill="url(#s)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="11">
    <text x="60" y="14" fill="#010101" fill-opacity=".3">Trace</text>
    <text x="60" y="13">Trace</text>
    <text x="${120 + textWidth / 2}" y="14" fill="#010101" fill-opacity=".3">${status}</text>
    <text x="${120 + textWidth / 2}" y="13">${status}</text>
  </g>
</svg>`;
}

export default plugin;
