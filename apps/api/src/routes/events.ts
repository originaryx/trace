import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { verifyHmac } from '../hmac.js';
import { checkReplayProtection } from '../replay-protection.js';
import { tenantRateLimit } from '../rate-limit.js';
import { batchTrackResources } from '../resource-tracker.js';

const CrawlEventSchema = z.object({
  ts: z.number().int().finite().optional(),
  host: z.string().min(1).max(255),
  path: z.string().min(1).max(2048),
  method: z.string().min(1).max(10),
  status: z.number().int().optional(),
  ua: z.string().min(0).max(2048).default(''),
  ip_prefix: z.string().max(64).optional(),
  asn: z.string().max(64).optional(),
  accept_lang: z.string().max(256).optional(),
  is_bot: z.boolean().optional(),
  crawler_family: z.string().max(64).optional(),
  bytes: z.number().int().optional(),
  req_time_ms: z.number().int().optional(),
  source: z.enum(['worker', 'nginx', 'cloudflare', 'fingerprint']).optional(),
  cf_ray_id: z.string().max(64).optional(),
  cf_bot_score: z.number().int().optional(),
  cf_bot_score_src: z.string().max(64).optional(),
  cf_bot_tags: z.array(z.string().max(64)).optional(),
  fp_visitor_id: z.string().max(128).optional(),
  fp_request_id: z.string().max(128).optional(),
  fp_bot_result: z.string().max(32).optional(),
  // Data Footprint fields
  response_bytes: z.number().int().optional(),
  content_type: z.string().max(128).optional(),
  etag: z.string().max(128).optional(),
  resource_hash: z.string().max(64).optional(), // SHA-256 hash
});

const plugin: FastifyPluginAsync = async (app) => {
  app.post('/events', async (req, rep) => {
    // HMAC authentication
    const keyId = String(req.headers['x-peac-key'] || '');
    const sig = String(req.headers['x-peac-signature'] || '');
    const ts = Number(req.headers['x-peac-timestamp'] || '0');

    if (!keyId || !sig || !ts) {
      return rep.code(401).send({ error: 'missing_auth_headers' });
    }

    // Timestamp skew check (5 minutes)
    if (Math.abs(Date.now() - ts) > 5 * 60 * 1000) {
      return rep.code(401).send({ error: 'timestamp_skew' });
    }

    // Fetch API key
    const apiKey = await (app as any).db.apiKey.findUnique({
      where: { id: keyId },
      include: { tenant: true },
    });

    if (!apiKey) {
      return rep.code(401).send({ error: 'invalid_api_key' });
    }

    // Get raw body bytes for HMAC verification
    const bytes = req.rawBody;
    if (!bytes) {
      return rep.code(400).send({ error: 'missing_body' });
    }

    // Verify HMAC signature
    if (!verifyHmac(bytes, sig, apiKey)) {
      return rep.code(401).send({ error: 'invalid_signature' });
    }

    // Replay protection: Check if this exact request has been seen before
    const isUnique = await checkReplayProtection(keyId, ts, bytes);
    if (!isUnique) {
      return rep.code(401).send({ error: 'replay_detected' });
    }

    // Per-tenant rate limiting (1000 req/min)
    try {
      await tenantRateLimit(apiKey.tenantId, 1000, 60_000);
    } catch (error) {
      return rep
        .code(429)
        .header('Retry-After', '60')
        .send({ error: 'rate_limit_exceeded' });
    }

    // Parse body (supports single JSON, array, or NDJSON)
    const ct = String(req.headers['content-type'] || '');
    let items: any[] = [];

    try {
      if (ct.includes('ndjson')) {
        items = bytes
          .toString('utf8')
          .split('\n')
          .filter(Boolean)
          .map((line: string) => JSON.parse(line));
      } else {
        const body = JSON.parse(bytes.toString('utf8'));
        items = Array.isArray(body) ? body : [body];
      }
    } catch (error) {
      return rep.code(400).send({ error: 'invalid_json' });
    }

    // Validate and normalize events
    const now = Date.now();
    const rows: any[] = [];

    for (const item of items) {
      try {
        const validated = CrawlEventSchema.parse(item);

        // Normalize timestamps: use server time as source of truth
        // Store client timestamp separately to detect clock skew
        const clientTimestamp = validated.ts;
        const serverTimestamp = now;

        rows.push({
          tenantId: apiKey.tenantId,
          ts: new Date(serverTimestamp), // Server time (trusted)
          clientTs: clientTimestamp ? new Date(clientTimestamp) : null, // Client time (untrusted)
          host: validated.host,
          path: validated.path,
          method: validated.method,
          status: validated.status ?? null,
          ua: validated.ua,
          ipPrefix: validated.ip_prefix ?? null,
          asn: validated.asn ?? null,
          acceptLang: validated.accept_lang ?? null,
          isBot: validated.is_bot ?? null,
          crawlerFamily: validated.crawler_family ?? null,
          bytes: validated.bytes ?? null,
          reqTimeMs: validated.req_time_ms ?? null,
          source: validated.source ?? 'worker',
          cfRayId: validated.cf_ray_id ?? null,
          cfBotScore: validated.cf_bot_score ?? null,
          cfBotScoreSrc: validated.cf_bot_score_src ?? null,
          cfBotTags: validated.cf_bot_tags ?? [],
          fpVisitorId: validated.fp_visitor_id ?? null,
          fpRequestId: validated.fp_request_id ?? null,
          fpBotResult: validated.fp_bot_result ?? null,
          // Data Footprint fields
          responseBytes: validated.response_bytes ?? null,
          contentType: validated.content_type ?? null,
          etag: validated.etag ?? null,
          resourceHash: validated.resource_hash ?? null,
        });
      } catch (error) {
        // Skip invalid events but continue processing others
        req.log.warn({ error, item }, 'Invalid event skipped');
      }
    }

    if (rows.length === 0) {
      return rep.code(400).send({ error: 'no_valid_events' });
    }

    // Batch insert
    await (app as any).db.crawlEvent.createMany({ data: rows });

    // Track resources asynchronously (don't block response)
    batchTrackResources((app as any).db, rows).catch((error) => {
      req.log.error({ error }, 'Failed to track resources');
    });

    return rep
      .code(202)
      .header('Cache-Control', 'no-store')
      .send({ ok: true, inserted: rows.length });
  });
};

export default plugin;
