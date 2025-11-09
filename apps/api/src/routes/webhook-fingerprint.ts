import { FastifyPluginAsync } from 'fastify';
import { hmacB64, safeEq } from '../hmac.js';

function toPrefix(ip: string): string {
  if (!ip) return '';
  if (ip.includes(':')) {
    return ip.split(':').slice(0, 3).join(':') + '::/48';
  }
  const parts = ip.split('.');
  return `${parts[0]}.${parts[1]}.${parts[2]}.0/24`;
}

const plugin: FastifyPluginAsync = async (app) => {
  app.post('/webhooks/fingerprint', { config: { rawBody: true } }, async (req, rep) => {
    const slug = String((req.query as any).tenant || '');
    const tenant = await (app as any).db.tenant.findFirst({
      where: { domain: slug },
    });

    if (!tenant) {
      return rep.code(404).send({ error: 'tenant_not_found' });
    }

    // Verify HMAC signature
    const sig = String(req.headers['x-fp-signature'] || req.headers['fingerprint-signature'] || '');
    const secret = process.env.FINGERPRINT_WEBHOOK_SECRET || '';

    if (!sig || !secret) {
      return rep.code(401).send({ error: 'missing_signature_or_secret' });
    }

    const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body));
    const expected = hmacB64(rawBody, secret);
    if (!safeEq(sig, expected)) {
      return rep.code(401).send({ error: 'invalid_signature' });
    }

    // Parse webhook payload
    const body = JSON.parse(rawBody.toString('utf8'));
    const url = new URL(body.url || body.requestUrl || 'https://example.com/');

    // Map bot result
    const botResult = body.bot?.result;
    let isBot: boolean | null = null;
    let crawlerFamily = 'humanish';

    if (botResult === 'good') {
      isBot = false;
      crawlerFamily = 'good-bot';
    } else if (botResult === 'bad') {
      isBot = true;
      crawlerFamily = 'unknown-bot';
    }

    // Insert event
    await (app as any).db.crawlEvent.create({
      data: {
        tenantId: tenant.id,
        ts: new Date(body.time || Date.now()),
        host: url.host,
        path: url.pathname,
        method: 'GET',
        status: null,
        ua: body.userAgent || '',
        ipPrefix: toPrefix(body.ip || ''),
        source: 'fingerprint',
        fpVisitorId: body.visitorId || null,
        fpRequestId: body.requestId || null,
        fpBotResult: botResult || null,
        isBot,
        crawlerFamily,
      },
    });

    return rep.code(202).send({ ok: true });
  });
};

export default plugin;
