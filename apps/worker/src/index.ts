/**
 * Originary Trace Cloudflare Worker
 * Detects bot traffic and posts events to Trace API
 */

interface Env {
  PEAC_ENDPOINT: string;
  PEAC_KEY: string;
  PEAC_SECRET: string;
  ORIGIN?: string; // Optional: explicit origin URL if Worker not mapped to zone
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const ua = request.headers.get('user-agent') || '';
    const lang = request.headers.get('accept-language') || '';
    const ip = request.headers.get('cf-connecting-ip') || '';
    const asn = request.headers.get('cf-asn') || '';
    const method = request.method;

    // Classify crawler family
    const ual = ua.toLowerCase();
    const family = /gptbot/.test(ual)
      ? 'gptbot'
      : /claudebot/.test(ual)
        ? 'claudebot'
        : /(googlebot|bingbot|yandex|baiduspider)/.test(ual)
          ? 'searchbot'
          : /(bot|crawler|spider|httpclient|fetch)/.test(ual)
            ? 'unknown-bot'
            : 'humanish';

    const isBot = family !== 'humanish';

    // Privacy-safe IP prefix
    const ipPrefix = ip.includes(':')
      ? ip.split(':').slice(0, 3).join(':') + '::/48'
      : ip.split('.').slice(0, 3).join('.') + '.0/24';

    // Fetch from origin
    // If ORIGIN is set, construct explicit URL; otherwise pass request directly (Worker mapped to zone)
    const response = env.ORIGIN
      ? await fetch(`${env.ORIGIN}${url.pathname}${url.search}`, {
          method: request.method,
          headers: request.headers,
          body: request.body,
        })
      : await fetch(request);

    // Capture Data Footprint info
    const contentType = response.headers.get('content-type') || undefined;
    const contentLength = response.headers.get('content-length');
    const etag = response.headers.get('etag') || undefined;

    let responseBytes: number | undefined;
    let resourceHash: string | undefined;

    // For bots, capture response body hash (Data Footprint tracking)
    // Skip HEAD requests and 304 Not Modified responses
    const shouldTrackFootprint = isBot
      && method !== 'HEAD'
      && response.status === 200
      && response.status !== 304;

    if (shouldTrackFootprint) {
      // Try to get size from Content-Length header
      let bytes = contentLength ? parseInt(contentLength, 10) : undefined;

      // Only hash responses under 10MB
      if (bytes && bytes > 0 && bytes < 10 * 1024 * 1024) {
        responseBytes = bytes;

        // Clone response to read body without consuming original
        const cloned = response.clone();

        try {
          const arrayBuffer = await cloned.arrayBuffer();

          // Use actual byte count if Content-Length was missing
          if (!bytes) {
            bytes = arrayBuffer.byteLength;
            responseBytes = bytes;
          }

          const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
          const hashArray = Array.from(new Uint8Array(hashBuffer));
          resourceHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        } catch (error) {
          // If hashing fails, continue without it
          console.error('Failed to hash response:', error);
        }
      } else if (bytes && bytes > 0) {
        // For large files, just track bytes without hashing
        responseBytes = bytes;
      }
    }

    // Build event with Data Footprint fields
    const event = {
      ts: Date.now(),
      host: url.host,
      path: url.pathname,
      method,
      status: response.status,
      ua,
      ip_prefix: ipPrefix,
      asn,
      accept_lang: lang,
      is_bot: isBot,
      crawler_family: family,
      source: 'worker',
      // Data Footprint fields
      response_bytes: responseBytes,
      content_type: contentType,
      etag: etag,
      resource_hash: resourceHash,
    };

    const body = JSON.stringify(event);
    const sig = await hmacSign(body, env.PEAC_SECRET);

    // Fire-and-forget log to Trace API
    ctx.waitUntil(
      fetch(env.PEAC_ENDPOINT + '/v1/events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Peac-Key': env.PEAC_KEY,
          'X-Peac-Signature': sig,
          'X-Peac-Timestamp': String(event.ts),
        },
        body,
      }).catch((error) => {
        console.error('Failed to log to Trace API:', error);
      })
    );

    // Add PEAC policy headers
    const headers = new Headers(response.headers);
    headers.set('PEAC-Policy', 'access=allowed; train=no; retain=7d');
    headers.set('Link', '</.well-known/peac.txt>; rel="policy"');

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  },
};

async function hmacSign(payload: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));

  return btoa(String.fromCharCode(...new Uint8Array(signature)));
}
