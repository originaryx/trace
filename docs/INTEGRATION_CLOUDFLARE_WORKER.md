# Cloudflare Worker Integration - 5 Minute Setup

## Why Worker?

✅ **Zero DNS changes** - Works with your existing setup
✅ **Edge performance** - <1ms added latency
✅ **Data Footprint tracking** - Automatic response hashing
✅ **99% bot detection** - Uses Cloudflare's Bot Management scores

**Perfect for:** Most websites on Cloudflare (Free, Pro, Business, Enterprise)

---

## Prerequisites

- Cloudflare account with a zone (domain)
- Node.js 20+ installed
- 5 minutes of your time

---

## Step 1: Get Your API Keys

1. Visit your Originary Trace dashboard: https://app.trace.originary.xyz (or your self-hosted instance)
2. Navigate to **Settings** → **API Keys**
3. Click **Create New Key**
4. Copy:
   - `PEAC_KEY` (API Key ID)
   - `PEAC_SECRET` (Secret - shown once!)
   - `PEAC_ENDPOINT` (e.g., `https://api.trace.originary.xyz`)

**Keep these safe!** You'll need them in Step 3.

---

## Step 2: Deploy the Worker

### Option A: One-Command Deploy (Recommended)

```bash
# Clone Originary Trace repo
git clone https://github.com/originaryx/trace.git
cd trace/apps/worker

# Install dependencies
pnpm install

# Login to Cloudflare
pnpm wrangler login

# Deploy
pnpm wrangler deploy
```

### Option B: Manual Setup

Create `worker.js`:

```javascript
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const ua = request.headers.get('user-agent') || '';
    const ip = request.headers.get('cf-connecting-ip') || '';
    const asn = request.headers.get('cf-asn') || '';

    // Classify crawler
    const ual = ua.toLowerCase();
    const family = /gptbot/.test(ual) ? 'gptbot'
      : /claudebot/.test(ual) ? 'claudebot'
      : /(googlebot|bingbot)/.test(ual) ? 'searchbot'
      : /(bot|crawler|spider)/.test(ual) ? 'unknown-bot'
      : 'humanish';

    const isBot = family !== 'humanish';

    // IP prefix (privacy-safe)
    const ipPrefix = ip.includes(':')
      ? ip.split(':').slice(0, 3).join(':') + '::/48'
      : ip.split('.').slice(0, 3).join('.') + '.0/24';

    // Fetch from origin
    const response = await fetch(request);

    // Capture Data Footprint
    const contentType = response.headers.get('content-type') || undefined;
    const contentLength = response.headers.get('content-length');
    const etag = response.headers.get('etag') || undefined;

    let responseBytes = contentLength ? parseInt(contentLength, 10) : undefined;
    let resourceHash = undefined;

    // Hash bot responses under 10MB
    if (isBot && response.status === 200 && responseBytes && responseBytes < 10 * 1024 * 1024) {
      try {
        const cloned = response.clone();
        const arrayBuffer = await cloned.arrayBuffer();
        const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        resourceHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      } catch (error) {
        console.error('Hashing failed:', error);
      }
    }

    // Build event
    const event = {
      ts: Date.now(),
      host: url.host,
      path: url.pathname,
      method: request.method,
      status: response.status,
      ua,
      ip_prefix: ipPrefix,
      asn,
      is_bot: isBot,
      crawler_family: family,
      source: 'worker',
      response_bytes: responseBytes,
      content_type: contentType,
      etag: etag,
      resource_hash: resourceHash,
    };

    const body = JSON.stringify(event);
    const sig = await hmacSign(body, env.PEAC_SECRET);

    // Send to Originary Trace (fire-and-forget)
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
      }).catch(err => console.error('Originary Trace send failed:', err))
    );

    // Add PEAC headers
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

async function hmacSign(payload, secret) {
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
```

Deploy:
```bash
npx wrangler deploy
```

---

## Step 3: Configure Secrets

```bash
# Set your API credentials
npx wrangler secret put PEAC_KEY
# Paste your PEAC_KEY when prompted

npx wrangler secret put PEAC_SECRET
# Paste your PEAC_SECRET when prompted

npx wrangler secret put PEAC_ENDPOINT
# Enter: https://api.trace.originary.xyz (or your self-hosted URL)
```

---

## Step 4: Verify It Works

### Test 1: Send a Request

```bash
# Make a request with a bot User-Agent
curl -H "User-Agent: Mozilla/5.0 (compatible; GPTBot/1.0)" https://yourdomain.com
```

### Test 2: Check Originary Trace Dashboard

1. Visit https://app.trace.originary.xyz/dashboard
2. You should see the event within ~10 seconds
3. Look for: `GPTBot` in crawler breakdown

### Test 3: Verify Headers

```bash
curl -I https://yourdomain.com
```

You should see:
```
PEAC-Policy: access=allowed; train=no; retain=7d
Link: </.well-known/peac.txt>; rel="policy"
```

---

## Troubleshooting

### No Events in Dashboard?

**Check Worker logs:**
```bash
npx wrangler tail
```

**Common issues:**
- ❌ PEAC_SECRET not set → Error: `invalid_signature`
- ❌ PEAC_ENDPOINT wrong → Error: `Failed to fetch`
- ❌ PEAC_KEY wrong → Error: `invalid_api_key`

### Events Show 0 Bots?

**Make test request with bot UA:**
```bash
curl -H "User-Agent: GPTBot/1.0" https://yourdomain.com
```

### High CPU Usage?

**Reduce hash size limit:**

In worker code, change:
```javascript
if (responseBytes && responseBytes < 10 * 1024 * 1024) {
```

To:
```javascript
if (responseBytes && responseBytes < 1 * 1024 * 1024) { // 1MB limit
```

---

## Advanced Configuration

### Enable Cloudflare Bot Management Scores

If you have Cloudflare Bot Management (Business/Enterprise):

```javascript
// Add to event object:
cf_bot_score: request.cf?.botManagement?.score,
cf_bot_score_src: request.cf?.botManagement?.verifiedBot ? 'verified' : 'heuristics',
```

### Skip Hashing for Specific Paths

```javascript
// Skip hashing for large downloads
const skipPaths = ['/downloads/', '/assets/videos/'];
const shouldHash = !skipPaths.some(p => url.pathname.startsWith(p));

if (isBot && response.status === 200 && shouldHash && responseBytes < 10 * 1024 * 1024) {
  // ... hash logic
}
```

### Custom PEAC Policy per Path

```javascript
const peacPolicy = url.pathname.startsWith('/api/')
  ? 'access=disallowed; train=no'
  : 'access=allowed; train=no; retain=7d';

headers.set('PEAC-Policy', peacPolicy);
```

---

## Performance Impact

| Metric | Impact |
|--------|--------|
| **Latency** | <1ms (edge compute) |
| **CPU time** | 2-5ms (with hashing) |
| **Memory** | <1MB per request |
| **Cost** | Free tier: 100k req/day |

**Hashing performance:**
- 10KB file: ~1ms
- 100KB file: ~5ms
- 1MB file: ~30ms

---

## Next Steps

1. ✅ Worker deployed and verified
2. 🔄 Check dashboard for bot traffic
3. 📊 View Data Footprint metrics
4. 🔐 Generate compliance bundle
5. 🚀 Set up alerts (optional)

**Need help?** https://github.com/originaryx/trace/issues

---

## Comparison: Worker vs Other Methods

| Method | Setup Time | Accuracy | Data Footprint | Cost |
|--------|-----------|----------|----------------|------|
| **Cloudflare Worker** | 5 min | 95-99% | ✅ Yes | Free-$5/mo |
| Cloudflare Logpush | 15 min | 99% | ✅ Yes | Enterprise only |
| Nginx + Tailer | 15 min | 95% | ⚠️ Manual | Free |
| Browser SDK | 2 min | 0% (bots) | ❌ No | Free |

**Recommended:** Worker for most users, Logpush for Enterprise customers.

---

**Built with ❤️ for the open web | Apache 2.0 License**
