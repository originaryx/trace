import { FastifyPluginAsync } from 'fastify';
import { getTenantByDomain } from '../auth.js';

const plugin: FastifyPluginAsync = async (app) => {
  // Public stats endpoint
  app.get('/public/stats', async (req, rep) => {
    const tenantDomain = String((req.query as any).tenant || '');

    if (!tenantDomain) {
      return rep.code(400).send({ error: 'missing_tenant_parameter' });
    }

    const tenant = await getTenantByDomain(tenantDomain);
    if (!tenant) {
      return rep.code(404).send({ error: 'tenant_not_found' });
    }

    const total = await (app as any).db.crawlEvent.count({
      where: { tenantId: tenant.id },
    });

    const bots = await (app as any).db.crawlEvent.count({
      where: { tenantId: tenant.id, isBot: true },
    });

    return rep.send({ bots, total });
  });

  // SVG badge endpoint
  app.get('/badge/:domain.svg', async (req, rep) => {
    const domain = (req.params as any).domain;

    const tenant = await getTenantByDomain(domain);
    if (!tenant) {
      return rep.code(404).send({ error: 'tenant_not_found' });
    }

    const total = await (app as any).db.crawlEvent.count({
      where: { tenantId: tenant.id },
    });

    const bots = await (app as any).db.crawlEvent.count({
      where: { tenantId: tenant.id, isBot: true },
    });

    const pct = total ? Math.round((bots / total) * 100) : 0;

    // Generate SVG badge
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="20">
  <linearGradient id="b" x2="0" y2="100%">
    <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
    <stop offset="1" stop-opacity=".1"/>
  </linearGradient>
  <mask id="a">
    <rect width="120" height="20" rx="3" fill="#fff"/>
  </mask>
  <g mask="url(#a)">
    <path fill="#555" d="M0 0h50v20H0z"/>
    <path fill="${pct > 50 ? '#e05d44' : pct > 25 ? '#dfb317' : '#97ca00'}" d="M50 0h70v20H50z"/>
    <path fill="url(#b)" d="M0 0h120v20H0z"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="DejaVu Sans,Verdana,Geneva,sans-serif" font-size="11">
    <text x="25" y="15" fill="#010101" fill-opacity=".3">bots</text>
    <text x="25" y="14">bots</text>
    <text x="84" y="15" fill="#010101" fill-opacity=".3">${pct}%</text>
    <text x="84" y="14">${pct}%</text>
  </g>
</svg>`;

    rep.header('content-type', 'image/svg+xml');
    rep.header('cache-control', 'no-cache, no-store, must-revalidate');
    return rep.send(svg);
  });
};

export default plugin;
