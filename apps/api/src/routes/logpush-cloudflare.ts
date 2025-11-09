import { FastifyPluginAsync } from 'fastify';

function toPrefix(ip: string): string {
  if (!ip) return '';
  if (ip.includes(':')) {
    return ip.split(':').slice(0, 3).join(':') + '::/48';
  }
  const parts = ip.split('.');
  return `${parts[0]}.${parts[1]}.${parts[2]}.0/24`;
}

const plugin: FastifyPluginAsync = async (app) => {
  app.post('/logpush/cloudflare', { config: { rawBody: true } }, async (req, rep) => {
    // Verify shared token (optional but recommended)
    const token = req.headers['x-originary-token'];
    const expectedToken = process.env.CLOUDFLARE_LOGPUSH_TOKEN;

    if (expectedToken && token !== expectedToken) {
      return rep.code(401).send({ error: 'invalid_token' });
    }

    // Get tenant from query parameter
    const slug = String((req.query as any).tenant || '');
    if (!slug) {
      return rep.code(400).send({ error: 'missing_tenant_parameter' });
    }

    const tenant = await (app as any).db.tenant.findFirst({
      where: { domain: slug },
    });

    if (!tenant) {
      return rep.code(404).send({ error: 'tenant_not_found' });
    }

    // Parse NDJSON or JSON array
    const ct = String(req.headers['content-type'] || '');
    let rows: any[] = [];

    try {
      if (ct.includes('ndjson')) {
        const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body));
        rows = rawBody
          .toString('utf8')
          .split('\n')
          .filter(Boolean)
          .map((line: string) => JSON.parse(line));
      } else {
        const body = req.body as any;
        rows = Array.isArray(body) ? body : [body];
      }
    } catch (error) {
      return rep.code(400).send({ error: 'invalid_json' });
    }

    // Process and insert events
    const events: any[] = [];
    for (const r of rows) {
      const botScore = typeof r.BotScore === 'number' ? r.BotScore : null;
      const botTags = Array.isArray(r.BotTags) ? r.BotTags : [];
      const isBot = botScore !== null ? botScore < 30 : null;

      let crawlerFamily = 'humanish';
      if (botTags.includes('VerifiedBot')) {
        crawlerFamily = 'verified-bot';
      } else if (isBot) {
        crawlerFamily = 'unknown-bot';
      }

      events.push({
        tenantId: tenant.id,
        ts: new Date(r.EdgeStartTimestamp || Date.now()),
        host: r.ClientRequestHost || '',
        path: r.ClientRequestURI || '/',
        method: r.ClientRequestMethod || 'GET',
        status: r.EdgeResponseStatus || null,
        ua: r.UserAgent || '',
        ipPrefix: toPrefix(r.ClientIP || ''),
        source: 'cloudflare',
        cfRayId: r.RayID || null,
        cfBotScore: botScore,
        cfBotScoreSrc: r.BotScoreSrc || null,
        cfBotTags: botTags,
        isBot,
        crawlerFamily,
      });
    }

    if (events.length > 0) {
      await (app as any).db.crawlEvent.createMany({ data: events });
    }

    return rep.code(202).send({ ok: true, inserted: events.length });
  });
};

export default plugin;
