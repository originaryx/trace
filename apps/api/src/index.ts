import Fastify from 'fastify';
import helmet from '@fastify/helmet';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUI from '@fastify/swagger-ui';
import { PrismaClient } from '@prisma/client';
import { nanoid } from 'nanoid';
import { Registry, collectDefaultMetrics, Counter, Histogram } from 'prom-client';

// Routes
import eventsRoute from './routes/events.js';
import verifyRoute from './routes/verify.js';
import logpushRoute from './routes/logpush-cloudflare.js';
import fingerprintRoute from './routes/webhook-fingerprint.js';
import exportsRoute from './routes/exports.js';
import publicRoute from './routes/public.js';
import dataFootprintRoute from './routes/data-footprint.js';
import complianceBundleRoute from './routes/compliance-bundle.js';
import apiKeysRoute from './routes/api-keys.js';
import tenantSettingsRoute from './routes/tenant-settings.js';
import badgeRoute from './routes/badge.js';

const prisma = new PrismaClient();

// Prometheus setup
const register = new Registry();
collectDefaultMetrics({ register });

const httpRequestsTotal = new Counter({
  name: 'trace_http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

const httpRequestDuration = new Histogram({
  name: 'trace_http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route'],
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [register],
});

const app = Fastify({
  logger: {
    level: process.env.LOG_LEVEL || 'info',
    redact: {
      paths: [
        'req.headers["x-peac-signature"]',
        'req.headers["x-peac-secret"]',
        'req.headers.authorization',
        'req.headers.cookie',
        '*.secret',
        '*.password',
        '*.token',
      ],
      censor: '[REDACTED]',
    },
    transport:
      process.env.NODE_ENV === 'development'
        ? {
            target: 'pino-pretty',
            options: {
              colorize: true,
              translateTime: 'HH:MM:ss',
              ignore: 'pid,hostname',
            },
          }
        : undefined,
  },
  bodyLimit: 2 * 1024 * 1024, // 2MB limit for request bodies
});

// Decorate app with Prisma client
app.decorate('db', prisma);

// Extend FastifyRequest to include rawBody
declare module 'fastify' {
  interface FastifyRequest {
    rawBody?: Buffer;
  }
}

// Capture raw body for HMAC verification
app.addContentTypeParser('application/json', { parseAs: 'buffer' }, async (req: any, body: any) => {
  req.rawBody = body as Buffer;
  return JSON.parse(body.toString('utf8'));
});

app.addContentTypeParser('application/x-ndjson', { parseAs: 'buffer' }, async (req: any, body: any) => {
  req.rawBody = body as Buffer;
  // Return empty object as placeholder - actual parsing happens in route handler
  return {};
});

// Shutdown hook
app.addHook('onClose', async () => {
  await prisma.$disconnect();
});

// Security: Helmet
await app.register(helmet, {
  contentSecurityPolicy: false, // Let Next.js handle CSP
  crossOriginEmbedderPolicy: false, // Allow embedding
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true,
  },
  frameguard: { action: 'deny' }, // Prevent clickjacking
  noSniff: true, // Prevent MIME type sniffing
  xssFilter: true, // Enable XSS filter
});

// CORS - Strict origin allowlist
await app.register(cors, {
  origin(origin, cb) {
    const allow = process.env.CORS_ALLOW_ORIGINS?.split(',').map((s) => s.trim());
    if (!origin || allow?.includes('*') || allow?.includes(origin)) {
      return cb(null, true);
    }
    cb(new Error('CORS origin not allowed'), false);
  },
  credentials: true,
});

// Global rate limiting
await app.register(rateLimit, {
  max: 100,
  timeWindow: '1 minute',
});

// Request ID, metrics tracking, and per-tenant CORS validation
app.addHook('onRequest', async (req, rep) => {
  // Set request ID
  const requestId = (req.headers['x-request-id'] as string) || nanoid(12);
  req.id = requestId;
  rep.header('x-request-id', requestId);

  // Start timer for request duration
  (req as any)._startTime = process.hrtime.bigint();

  // Per-tenant CORS validation
  const origin = req.headers.origin;
  const keyId = req.headers['x-peac-key'] as string;

  // If origin present and API key present, validate against tenant's CORS origins
  if (origin && keyId) {
    try {
      const apiKey = await (app as any).db.apiKey.findUnique({
        where: { id: keyId },
        include: {
          tenant: {
            include: { settings: true },
          },
        },
      });

      if (apiKey?.tenant?.settings?.corsOrigins) {
        const tenantOrigins = apiKey.tenant.settings.corsOrigins
          .split(',')
          .map((s: string) => s.trim())
          .filter(Boolean);

        // If tenant has specific CORS origins configured, validate
        if (tenantOrigins.length > 0 && !tenantOrigins.includes(origin)) {
          return rep.code(403).send({ error: 'origin_not_allowed_for_tenant' });
        }
      }
    } catch (error) {
      // If lookup fails, let the request continue (HMAC will catch invalid keys)
      req.log.warn({ error, keyId }, 'Failed to validate tenant CORS');
    }
  }
});

// Track request metrics
app.addHook('onResponse', async (req, rep) => {
  // Use route config URL to prevent cardinality explosion (parameterized routes)
  const route = req.routeOptions?.url || 'unknown';
  const method = req.method;
  const code = String(rep.statusCode);

  // Record request count with normalized labels to prevent cardinality explosion
  httpRequestsTotal.inc({ method, route, status_code: code });

  // Record request duration
  if ((req as any)._startTime) {
    const duration = Number(process.hrtime.bigint() - (req as any)._startTime) / 1e9;
    httpRequestDuration.observe({ method, route }, duration);
  }
});

// OpenAPI / Swagger
await app.register(swagger, {
  openapi: {
    info: {
      title: 'Originary Trace API',
      description: 'Distributed tracing for your content. Track AI crawler compliance with PEAC Protocol.',
      version: '0.1.0',
    },
    servers: [
      {
        url: 'http://localhost:8787',
        description: 'Development server',
      },
    ],
    components: {
      securitySchemes: {
        PeacHmac: {
          type: 'apiKey',
          in: 'header',
          name: 'X-Peac-Signature',
          description: 'HMAC-SHA256 signature of request body',
        },
        PeacKey: {
          type: 'apiKey',
          in: 'header',
          name: 'X-Peac-Key',
          description: 'API key identifier',
        },
        PeacTs: {
          type: 'apiKey',
          in: 'header',
          name: 'X-Peac-Timestamp',
          description: 'Request timestamp (epoch milliseconds)',
        },
      },
    },
    security: [{ PeacHmac: [], PeacKey: [], PeacTs: [] }],
  },
});

await app.register(swaggerUI, {
  routePrefix: '/docs',
  uiConfig: {
    docExpansion: 'list',
    deepLinking: false,
  },
});

// Health check (liveness probe)
app.get('/health', async (_req, _rep) => {
  return { status: 'ok', timestamp: Date.now() };
});

// Liveness endpoint (alias for /health)
app.get('/healthz', async (_req, _rep) => {
  return { status: 'ok', timestamp: Date.now() };
});

// Readiness check (checks all dependencies)
app.get('/readyz', async (req, rep) => {
  const checks = {
    database: 'unknown',
    encryption: 'unknown',
  };

  // Check database connection
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = 'ok';
  } catch (error) {
    checks.database = 'error';
    rep.code(503);
    return { status: 'not_ready', checks, timestamp: Date.now() };
  }

  // Check encryption key is configured
  checks.encryption = process.env.API_SECRET_MASTER_KEY ? 'ok' : 'not_configured';

  const ready = checks.database === 'ok' && checks.encryption === 'ok';

  if (!ready) {
    rep.code(503);
    return { status: 'not_ready', checks, timestamp: Date.now() };
  }

  return { status: 'ready', checks, timestamp: Date.now() };
});

// JWKS endpoint (public keys for Ed25519 receipts)
app.get('/.well-known/jwks.json', async (req, rep) => {
  const kid = process.env.PEAC_JWS_KID || 'peac-2025-11';
  const pub = process.env.PEAC_JWS_PUBLIC;

  if (!pub) {
    return rep.code(500).send({ error: 'public_key_not_configured' });
  }

  return rep.send({
    keys: [
      {
        kty: 'OKP',
        crv: 'Ed25519',
        kid,
        x: pub,
        use: 'sig',
        alg: 'EdDSA',
      },
    ],
  });
});

// Prometheus metrics endpoint
app.get('/metrics', async (req, rep) => {
  rep.header('Content-Type', register.contentType);
  return rep.send(await register.metrics());
});

// Register routes
await app.register(eventsRoute, { prefix: '/v1' });
await app.register(verifyRoute, { prefix: '/v1' });
await app.register(logpushRoute, { prefix: '/v1' });
await app.register(fingerprintRoute, { prefix: '/v1' });
await app.register(exportsRoute, { prefix: '/v1' });
await app.register(publicRoute, { prefix: '/v1' });
await app.register(dataFootprintRoute, { prefix: '/v1' });
await app.register(complianceBundleRoute, { prefix: '/v1' });
await app.register(apiKeysRoute, { prefix: '/v1' });
await app.register(tenantSettingsRoute, { prefix: '/v1' });
await app.register(badgeRoute, { prefix: '/v1' });

// Start server
const port = Number(process.env.PORT || 8787);
const host = process.env.HOST || '0.0.0.0';

try {
  await app.listen({ port, host });
  app.log.info(`🚀 Originary Trace API running on http://${host}:${port}`);
  app.log.info(`📚 API docs available at http://${host}:${port}/docs`);
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
