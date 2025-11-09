# Originary Trace Integration Guide

## Quick Comparison: Which Method Should You Use?

| Method | Best For | Setup Time | Performance Impact | Accuracy |
|--------|----------|------------|-------------------|----------|
| **Browser SDK** | Static sites, SPAs | 2 min | 0ms (async) | 70-80% |
| **Cloudflare Worker** | Sites on Cloudflare | 10 min | 0ms (edge) | 70-95% |
| **Nginx Tailer** | Self-hosted sites | 15 min | 0ms (server-side) | 70-95% |
| **Cloudflare Logpush** | Enterprise Cloudflare | 5 min | 0ms (async) | 99%+ |
| **Fingerprint Webhooks** | Sites using Fingerprint | 5 min | 0ms (async) | 99%+ |
| **WordPress Plugin** | WordPress sites | 2 min | 0ms (async) | 70-80% |

---

## Method 1: Browser SDK (Recommended for Most)

### Perfect For:
- ✅ Static sites (Netlify, Vercel, GitHub Pages)
- ✅ SPAs (React, Vue, Next.js, Svelte)
- ✅ Sites without server access
- ✅ Quick drop-in integration

### Installation:

```html
<!-- Add to your HTML <head> or before </body> -->
<script src="https://cdn.trace.originary.xyz/v1/trace.min.js"
        data-key="pk_live_abc123"
        data-tenant="yoursite.com"
        async></script>
```

### Performance:
- **File size:** 3KB minified + gzipped
- **Load time:** <50ms (async, non-blocking)
- **Execution:** <5ms (after page load)
- **Network:** Async beacon (doesn't block)

**Impact on Google PageSpeed:** 0 points (async script)

### SPA Integration (React Example):

```jsx
// app.jsx
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

function App() {
  const location = useLocation();

  useEffect(() => {
    // Track route changes
    if (window.Originary Trace) {
      window.Originary Trace.track();
    }
  }, [location]);

  return <YourApp />;
}
```

### Accuracy:
- **Known AI bots:** 95% (GPTBot, ClaudeBot, etc.)
- **Search engines:** 95% (Googlebot, Bingbot, etc.)
- **Unknown bots:** 70% (generic patterns)
- **Sophisticated fraud:** 10-30% (not designed for this)

**See [docs/ACCURACY.md](ACCURACY.md) for detailed breakdown.**

---

## Method 2: Cloudflare Worker (99% Accuracy)

### Perfect For:
- ✅ Sites already on Cloudflare
- ✅ Need 99%+ accuracy
- ✅ Want server-side detection
- ✅ No client-side JavaScript needed

### Installation:

```bash
cd apps/worker
pnpm install
wrangler login
wrangler deploy --env production

# Set secrets
wrangler secret put PEAC_KEY
wrangler secret put PEAC_SECRET
```

### Performance:
- **Edge execution:** 0ms added latency
- **Client impact:** Zero (server-side only)
- **Cost:** Free (Cloudflare Workers free tier: 100k requests/day)

### Accuracy:
- **99%+ accuracy** (uses Cloudflare Bot Management scores if enabled)
- **95% accuracy** (without Bot Management, UA-based only)

### How It Works:

```
User Request → Cloudflare Worker (edge)
             ↓
             Bot Detection (UA + CF scores)
             ↓
             Log to Originary Trace API (async)
             ↓
             Proxy to Origin Server
             ↓
User Response ← (no delay)
```

---

## Method 3: Nginx Tailer (Self-Hosted)

### Perfect For:
- ✅ Self-hosted sites
- ✅ Full control over infrastructure
- ✅ Don't want client-side tracking
- ✅ High traffic sites

### Installation:

1. **Add to nginx.conf:**

```nginx
log_format peac '$msec "$request" $status $bytes_sent '
                '"$http_user_agent" $remote_addr $http_accept_language '
                '$request_time $server_name $peac_family';

access_log /var/log/nginx/peac.log peac;
```

2. **Start tailer:**

```bash
cd apps/tailer
go build -o trace-tailer main.go
./trace-tailer -file=/var/log/nginx/peac.log \
  -endpoint=https://api.trace.originary.xyz \
  -key=pk_live_abc123 \
  -secret=sk_live_xyz789
```

### Performance:
- **Nginx impact:** ~0.1ms per request (logging)
- **Tailer:** Runs asynchronously, no impact
- **Client:** Zero impact (server-side only)

---

## Method 4: Cloudflare Logpush (Enterprise - 99% Accuracy)

### Perfect For:
- ✅ Cloudflare Enterprise customers
- ✅ Already using Bot Management
- ✅ Need maximum accuracy
- ✅ Want seamless integration

### Installation:

1. Cloudflare Dashboard → Logs → Logpush → Create job
2. Dataset: **HTTP requests**
3. Destination: `https://api.trace.originary.xyz/v1/logpush/cloudflare?tenant=yoursite.com`
4. Fields: Include `BotScore`, `BotScoreSrc`, `BotTags`

### Performance:
- **Zero impact** (logs sent after response)
- **Batch processing** (efficient)

### Accuracy:
- **99.5%+ accuracy** (Cloudflare Bot Management)
- Best-in-class fraud detection
- Real-time threat intelligence

---

## Method 5: Fingerprint Webhooks (99.5% Accuracy)

### Perfect For:
- ✅ Sites already using Fingerprint
- ✅ Need visitor identification
- ✅ Fraud prevention + bot analytics
- ✅ Want maximum accuracy

### Installation:

1. Fingerprint Dashboard → Webhooks → Create
2. URL: `https://api.trace.originary.xyz/v1/webhooks/fingerprint?tenant=yoursite.com`
3. Copy webhook secret to Originary Trace settings

### Performance:
- **Zero impact** (webhooks sent server-to-server)
- **Async processing**

### Accuracy:
- **99.5%+ accuracy** (Fingerprint Smart Signals)
- Detects sophisticated bots
- Visitor identification

---

## Method 6: WordPress Plugin

### Perfect For:
- ✅ WordPress sites
- ✅ No technical setup needed
- ✅ GUI configuration

### Installation:

1. Download plugin from GitHub
2. Upload to `/wp-content/plugins/`
3. Activate in WordPress admin
4. Settings → Originary Trace → Enter API key

### Performance:
- **Async HTTP requests** (non-blocking)
- **No JavaScript** (server-side only)
- **Impact:** <5ms per request

---

## Performance Comparison

### Client-Side Impact

| Method | Page Load | Render Blocking | Network Requests |
|--------|-----------|-----------------|------------------|
| Browser SDK | +50ms (async) | No | 1 (async beacon) |
| Cloudflare Worker | 0ms | No | 0 (server-side) |
| Nginx | 0ms | No | 0 (server-side) |
| Logpush | 0ms | No | 0 (server-side) |
| Fingerprint | 0ms | No | 0 (webhooks) |
| WordPress | 0ms | No | 0 (server-side) |

### Server-Side Impact

| Method | Added Latency | CPU Usage | Memory |
|--------|---------------|-----------|---------|
| Browser SDK | 0ms | 0% | 0MB |
| Cloudflare Worker | <1ms | Minimal | Edge |
| Nginx | 0.1ms | <1% | ~10MB |
| Logpush | 0ms | 0% | 0MB |
| Fingerprint | 0ms | 0% | 0MB |
| WordPress | 2-5ms | <1% | ~5MB |

**Verdict:** All methods have negligible performance impact! ✅

---

## Accuracy Comparison

### Detection Capabilities

| Bot Type | Browser SDK | Server-Side | Cloudflare | Fingerprint |
|----------|-------------|-------------|------------|-------------|
| GPTBot | 95% | 95% | 99% | 99% |
| ClaudeBot | 95% | 95% | 99% | 99% |
| Googlebot | 95% | 95% | 99% | 99% |
| Generic bots | 70% | 75% | 95% | 98% |
| Headless | 65% | 40% | 98% | 99.5% |
| Fraud bots | 10% | 10% | 99% | 99.5% |

### Recommendation:

- **Free + Good accuracy:** Browser SDK or Nginx (70-80%)
- **Best accuracy:** Cloudflare Logpush or Fingerprint (99%+)
- **Balanced:** Cloudflare Worker (95%)

---

## Cost Comparison

| Method | Infrastructure Cost | Originary Trace Cost | Total/Month |
|--------|---------------------|---------------|-------------|
| Browser SDK | $0 (CDN) | $0 | **$0** |
| Cloudflare Worker | $0 (free tier) | $0 | **$0** |
| Nginx | $5-50 (server) | $0 | **$5-50** |
| Cloudflare Logpush | $200+ (Enterprise) | $0 | **$200+** |
| Fingerprint | $99+ | $0 | **$99+** |
| WordPress | $5-50 (hosting) | $0 | **$5-50** |

**Originary Trace is always free!** Cost depends on your existing infrastructure.

---

## Recommendations by Use Case

### Static Site (Netlify, Vercel, GitHub Pages)
**→ Use Browser SDK**
- Zero config, just drop in script tag
- 3KB, async, no performance impact
- 70-80% accuracy (sufficient for AI crawlers)

### E-commerce Site (Fraud Prevention)
**→ Use Fingerprint + Originary Trace**
- 99.5% accuracy for fraud detection
- Visitor identification
- Originary Trace adds AI crawler insights

### High-Traffic Site (Cloudflare)
**→ Use Cloudflare Worker or Logpush**
- Edge execution, zero latency
- 95-99% accuracy
- Scales infinitely

### WordPress Blog
**→ Use WordPress Plugin**
- GUI configuration
- No technical setup
- Auto-updates

### Self-Hosted (VPS, Dedicated)
**→ Use Nginx Tailer**
- Full control
- Server-side only
- No client dependencies

---

## Migration Path

### Start Simple, Scale Up

1. **Week 1:** Browser SDK (2 min setup)
   - Get baseline data
   - Identify top crawlers
   - 70-80% accuracy

2. **Week 2:** Add Cloudflare Worker (if on CF)
   - Improve to 95% accuracy
   - Server-side tracking
   - Compare with client-side data

3. **Month 2:** Add Cloudflare Logpush (if Enterprise)
   - Reach 99%+ accuracy
   - Full Bot Management integration
   - Production-grade detection

**You can run multiple methods simultaneously!** Originary Trace will deduplicate events automatically.

---

## FAQs

### Q: Can I use multiple methods at once?

**A:** Yes! Originary Trace deduplicates events automatically. Common setup:
- Browser SDK for client-side tracking
- Cloudflare Worker for server-side validation
- Best of both worlds

### Q: Which method has the least performance impact?

**A:** All methods have <5ms impact. Server-side methods (Worker, Nginx, Logpush) have **zero client-side impact**.

### Q: Which method is most accurate?

**A:** Cloudflare Logpush (99.5%) or Fingerprint webhooks (99.5%). But for AI crawler tracking, Browser SDK (70-80%) is usually sufficient since AI bots identify themselves.

### Q: Can I self-host everything?

**A:** Yes! Use Nginx tailer + self-hosted Originary Trace API. Total cost: $5-50/month (server only).

### Q: What about GDPR/privacy?

**A:** Originary Trace only stores IP prefixes (/24), not full IPs. No cookies, no user tracking. GDPR-compliant by design.

---

## Next Steps

1. **Choose your method** (start with Browser SDK if unsure)
2. **Get API key** from demo.trace.originary.xyz
3. **Install** (follow method-specific docs)
4. **Deploy** and start tracking!
5. **Upgrade** to more accurate methods as needed

**Full documentation:** [trace.originary.xyz/docs](https://trace.originary.xyz/docs)
