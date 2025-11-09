# Originary Trace Browser SDK

**⚠️ IMPORTANT: This is a COMPLEMENTARY tool, NOT a primary bot tracker!**

Most crawlers fetch HTML without executing JavaScript. You will **not** see bot traffic via this snippet.

**For accurate bot analytics, use:**
1. **Cloudflare Worker** (recommended) - sees all requests
2. **Nginx + Go tailer** - server-side logs
3. **Cloudflare Logpush** - enterprise-grade accuracy

**Use this SDK for:**
- ✅ Human traffic baseline (to calculate bot %)
- ✅ SPA route tracking (React, Vue, Next.js)
- ✅ Page context for static sites

---

## Quick Start

```html
<link rel="preconnect" href="https://api.trace.originary.xyz" crossorigin>
<script
  src="https://cdn.trace.originary.xyz/v1/trace.min.js"
  data-tenant="example.com"
  data-pub="pk_live_xxx"
  async defer
  integrity="sha384-REPLACE_ME"
  crossorigin="anonymous"></script>
<noscript>
  <img src="https://api.trace.originary.xyz/v1/p.gif?tenant=example.com" alt="" width="1" height="1">
</noscript>
```

### Configuration

| Attribute | Required | Description | Example |
|-----------|----------|-------------|---------|
| `data-tenant` | ✅ Yes | Your domain | `example.com` |
| `data-pub` | ✅ Yes | Publishable key (NOT secret!) | `pk_live_xxx` |
| `data-endpoint` | No | Custom API endpoint | `https://api.trace.originary.xyz` |
| `data-debug` | No | Enable debug logging | `true` |

**Note:** Use `data-pub` (publishable key), **NOT** `data-key` (secret). Publishable keys are safe to expose in HTML.

---

## What Gets Tracked

```json
{
  "ts": 1699564800000,
  "kind": "pageview",
  "tenant": "example.com",
  "path": "/blog/post",
  "ref": "https://google.com",
  "ua": "Mozilla/5.0 ...",
  "lang": "en-US",
  "scr": { "w": 1920, "h": 1080 },
  "src": "browser-sdk",
  "pub": "pk_live_xxx"
}
```

**Privacy-safe:**
- ❌ No cookies
- ❌ No localStorage
- ❌ No fingerprinting
- ❌ No persistent IDs
- ✅ Respects DNT and GPC
- ✅ No user tracking

---

## Why JS Doesn't Catch Crawlers ⚠️

### The Problem

Most bots fetch HTML **without executing JavaScript**:

```bash
# How crawlers work:
curl https://example.com
# → Gets HTML, ignores <script> tags
# → Your SDK never runs!
```

**Result:** You'll see ~0 bot events via the browser SDK.

### What You'll Actually See

| Visitor Type | Browser SDK Sees? | Why? |
|--------------|-------------------|------|
| Human (Chrome) | ✅ Yes | Executes JavaScript |
| GPTBot | ❌ No | Fetches HTML only |
| ClaudeBot | ❌ No | Fetches HTML only |
| Googlebot | ❌ No | Fetches HTML only |
| BingBot | ❌ No | Fetches HTML only |

**Accuracy for bots: ~0%**

### Solution: Use Server-Side Tracking

For bot analytics, use **Cloudflare Worker** or **Nginx tailer**:

```nginx
# Nginx sees ALL requests (humans + bots)
access_log /var/log/nginx/peac.log peac;
```

Then use the browser SDK as a **complement** for human baseline:

```
Total traffic = 1000 requests (from Nginx)
Human traffic = 400 requests (from browser SDK)
Bot traffic = 600 requests (difference)
```

---

## Integration Patterns

### Pattern 1: Worker + SDK (Recommended)

```
┌─────────────────┐
│ Cloudflare      │  ALL traffic (bots + humans)
│ Worker          │  → 99% accurate
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Browser SDK     │  Human traffic only
│ (complement)    │  → Baseline for comparison
└─────────────────┘
```

**Result:** Accurate bot % = (Worker total - SDK humans) / Worker total

### Pattern 2: Nginx + SDK

```
┌─────────────────┐
│ Nginx Logs      │  Server-side (all requests)
│ + Go Tailer     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Browser SDK     │  Client-side (humans only)
└─────────────────┘
```

### Pattern 3: SDK Only (Static Sites)

```html
<!-- ⚠️ Limited: Won't see bots! -->
<script src="https://cdn.trace.originary.xyz/v1/trace.min.js"
        data-tenant="myblog.com"
        data-pub="pk_live_xxx"
        async defer></script>
```

**Use case:** Static blogs where you only care about human traffic patterns.

---

## SPA Integration

### React Router

```jsx
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

function App() {
  const location = useLocation();

  useEffect(() => {
    if (window.OriginaryTrace) {
      window.OriginaryTrace.track('route');
    }
  }, [location]);

  return <YourApp />;
}
```

### Next.js (App Router)

```tsx
'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

export function TraceTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (window.OriginaryTrace) {
      window.OriginaryTrace.track('route');
    }
  }, [pathname]);

  return null;
}
```

### Vue Router

```js
import { watch } from 'vue';
import { useRoute } from 'vue-router';

export default {
  setup() {
    const route = useRoute();
    watch(() => route.path, () => {
      if (window.OriginaryTrace) {
        window.OriginaryTrace.track('route');
      }
    });
  }
};
```

---

## Privacy Features

### Respects Do Not Track (DNT)

```javascript
// User has DNT enabled?
// → SDK won't load
if (navigator.doNotTrack === '1') {
  console.log('Trace respects DNT');
  return;
}
```

### Respects Global Privacy Control (GPC)

```javascript
// User has GPC enabled?
// → SDK won't load
if (navigator.globalPrivacyControl === true) {
  console.log('Trace respects GPC');
  return;
}
```

### No Persistent Storage

- ❌ No cookies
- ❌ No localStorage
- ❌ No IndexedDB
- ❌ No fingerprinting canvas

**Fully stateless tracking.**

---

## Performance

### Size

- **Unminified:** ~4.5 KB
- **Minified:** ~2.1 KB
- **Gzipped:** ~1.1 KB

Smaller than a single image!

### Load Impact

- **Blocking:** 0ms (async + defer)
- **Parse:** <5ms
- **Execute:** <2ms
- **Network:** Async (keepalive)

**PageSpeed Impact:** 0 points

### Benchmarks

| Metric | Value | vs Google Analytics |
|--------|-------|---------------------|
| File size | 1.1 KB gz | 45 KB gz (40× smaller) |
| Load time | <50ms | ~200ms (4× faster) |
| Blocking | 0ms | 0ms (both async) |
| Requests | 1 | 3-5 |

---

## CSP & SRI

### Content Security Policy

```html
<meta http-equiv="Content-Security-Policy"
      content="
        default-src 'self';
        script-src 'self' https://cdn.trace.originary.xyz;
        connect-src 'self' https://api.trace.originary.xyz;
      ">
```

### Subresource Integrity

```html
<script
  src="https://cdn.trace.originary.xyz/v1/trace.min.js"
  integrity="sha384-oqVuAfXRKap7fdgcCY5uykM6+R9GqQ8K/ux="
  crossorigin="anonymous"></script>
```

**Update hash per release!**

---

## API Reference

### `window.OriginaryTrace.track(kind?)`

Manually track an event.

```javascript
window.OriginaryTrace.track('pageview');  // Page view
window.OriginaryTrace.track('route');     // SPA route change
window.OriginaryTrace.track('ping');      // Keep-alive ping
```

### `window.OriginaryTrace.version`

Get SDK version.

```javascript
console.log(window.OriginaryTrace.version);  // "1.0.0"
```

---

## Deployment Checklist

- [ ] Deploy SDK to CDN with versioned path
- [ ] Generate SRI hash for `<script integrity>`
- [ ] Configure CSP headers
- [ ] Set cache headers: `Cache-Control: public, max-age=31536000, immutable`
- [ ] Add `<noscript>` fallback for JS-disabled browsers
- [ ] Add `<link rel="preconnect">` for faster API requests
- [ ] Use `data-pub` (publishable key), never `data-key` (secret)
- [ ] Test with DNT/GPC enabled
- [ ] Verify CORS is configured on API

---

## Comparison: SDK vs Server-Side

| Feature | Browser SDK | Cloudflare Worker | Nginx Tailer |
|---------|-------------|-------------------|--------------|
| **Sees bots** | ❌ No (~0%) | ✅ Yes (95-99%) | ✅ Yes (95%) |
| **Sees humans** | ✅ Yes (100%) | ✅ Yes (100%) | ✅ Yes (100%) |
| **Setup time** | 2 min | 10 min | 15 min |
| **Performance** | 0ms client | 0ms edge | 0ms server |
| **Accuracy** | Low for bots | High | High |
| **Use case** | Human baseline | Primary tracking | Primary tracking |

**Recommendation:** Always use Worker or Nginx as primary + SDK as complement.

---

## FAQs

### Q: Why not use this SDK alone?

**A:** Bots don't execute JavaScript. You'll see 0 bot events. Use Cloudflare Worker or Nginx tailer for bot tracking.

### Q: What's the point of the SDK then?

**A:** It provides a **human traffic baseline** to calculate bot percentage:

```
Bot % = (Total requests - SDK humans) / Total requests
```

### Q: Can I use it for SPA route tracking?

**A:** Yes! The SDK hooks `pushState` and `popstate` automatically.

### Q: Does it work with CSP?

**A:** Yes, with proper `script-src` and `connect-src` directives.

### Q: Is it GDPR compliant?

**A:** Yes. No cookies, no persistent IDs, respects DNT/GPC.

---

## Support

- **Docs:** [trace.originary.xyz/docs](https://trace.originary.xyz/docs)
- **GitHub:** [github.com/originaryx/trace](https://github.com/originaryx/trace)
- **Integration Guide:** [docs/INTEGRATION_GUIDE.md](../../docs/INTEGRATION_GUIDE.md)

---

## License

Apache 2.0 - see [LICENSE](../../LICENSE)
