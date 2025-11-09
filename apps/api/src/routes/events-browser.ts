/**
 * Browser events endpoint
 *
 * Accepts unsigned events from browser SDK (data-pub, not data-key).
 * Enforces origin validation and rate limiting.
 *
 * ⚠️ Browser SDK is COMPLEMENTARY only!
 * Most crawlers don't execute JavaScript, so this endpoint will NOT see bot traffic.
 * Use Cloudflare Worker, Nginx tailer, or Logpush for accurate bot analytics.
 */

import { z } from 'zod';
import type { FastifyPluginAsync } from 'fastify';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Zod schema for browser events
const BrowserEventSchema = z.object({
  ts: z.number().int().finite(),
  kind: z.enum(['pageview', 'route', 'ping']).default('pageview'),
  tenant: z.string().min(1).max(255),
  path: z.string().min(1).max(2048),
  ref: z.string().nullable().optional(),
  ua: z.string().min(0).max(2048),
  lang: z.string().nullable().optional(),
  scr: z.object({ w: z.number().int(), h: z.number().int() }).optional(),
  src: z.literal('browser-sdk'),
  pub: z.string().nullable().optional()
});

type BrowserEvent = z.infer<typeof BrowserEventSchema>;

/**
 * Simple in-memory rate limiter for browser events
 * (Use Redis in production for distributed rate limiting)
 */
const rateLimits = new Map<string, { count: number; reset: number }>();

function checkRateLimit(tenantId: string, maxRequests: number, windowMs: number): boolean {
  const now = Date.now();
  const key = `browser:${tenantId}`;
  const limit = rateLimits.get(key);

  if (!limit || now > limit.reset) {
    rateLimits.set(key, { count: 1, reset: now + windowMs });
    return true;
  }

  if (limit.count >= maxRequests) {
    return false;
  }

  limit.count++;
  return true;
}

const plugin: FastifyPluginAsync = async (app) => {
  app.post('/v1/events-browser', async (req, rep) => {
    try {
      // Parse event
      const event: BrowserEvent = BrowserEventSchema.parse(req.body);

      // Strict origin validation: require tenant domain to match Origin or Referer
      const origin = String(req.headers.origin || '');
      const referer = String(req.headers.referer || '');
      const originHost = origin ? new URL(origin).host : null;
      const refererHost = referer ? new URL(referer).host : null;

      // Must match tenant domain
      const validOrigin = originHost?.endsWith(event.tenant) || refererHost?.endsWith(event.tenant);
      if (!validOrigin) {
        app.log.warn({ origin, referer, tenant: event.tenant }, 'Browser event: origin mismatch');
        return rep.code(401).send({ error: 'invalid_origin' });
      }

      // Find tenant
      const tenant = await prisma.tenant.findFirst({
        where: { domain: event.tenant }
      });

      if (!tenant) {
        return rep.code(404).send({ error: 'tenant_not_found' });
      }

      // Rate limit: 2000 requests per minute per tenant
      if (!checkRateLimit(tenant.id, 2000, 60_000)) {
        return rep.code(429).send({ error: 'rate_limit_exceeded' });
      }

      // Store event
      // Browser events are NOT used for bot classification (crawlers don't run JS)
      // These are baseline human traffic for comparison
      await prisma.crawlEvent.create({
        data: {
          tenantId: tenant.id,
          ts: new Date(event.ts),
          host: event.tenant,
          path: event.path,
          method: 'GET',
          status: null,
          ua: event.ua,
          acceptLang: event.lang || null,
          source: 'browser',
          // Browser events default to human (bots don't execute JS)
          isBot: false,
          crawlerFamily: 'humanish'
        }
      });

      return rep.code(202).send({ ok: true });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return rep.code(400).send({ error: 'validation_failed', details: err.errors });
      }

      app.log.error(err, 'Browser event error');
      return rep.code(500).send({ error: 'internal_error' });
    }
  });
};

export default plugin;
