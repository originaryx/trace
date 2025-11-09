# Data Footprint: Track What AI Bots Scraped

## Overview

**Data Footprint** tracks how much data AI bots have scraped from your site. This is Originary Trace's unique value proposition: not just *who* visited, but *what they took*.

### The Problem

Publishers, API providers, and content creators ask:

> "How much of my content did GPTBot scrape? What's it worth?"

Traditional analytics tools show page views and traffic, but they don't answer:
- How many **bytes** of content were served to AI crawlers?
- How many **unique resources** did they access?
- How many **LLM tokens** does that represent?
- What's the **estimated value** for licensing negotiations?

### The Solution

Originary Trace's Data Footprint feature tracks three dimensions:

```
1. Transport Volume → Exact bytes served (from Content-Length)
2. Unique Content → Deduplicated resources (via SHA-256)
3. Semantic Tokens → Estimated LLM tokens (for licensing value)
```

---

## How It Works

### 1. Capture Response Metadata

When a bot makes a request, Originary Trace captures:

```typescript
{
  response_bytes: 45123,      // Content-Length header
  content_type: "text/html",  // Content-Type header
  etag: "abc123",             // ETag (for caching)
  resource_hash: "d8f7a2..."  // SHA-256 of response body
}
```

**Implementation:**
- **Cloudflare Worker**: Hashes response body for bots (under 10MB)
- **Nginx logs**: Extracts `$body_bytes_sent` and `$content_type`
- **Cloudflare Logpush**: Uses `EdgeResponseBytes` field

### 2. Deduplicate Content

The `resources` table tracks unique content:

```sql
CREATE TABLE resources (
  tenant_id UUID,
  host TEXT,
  path TEXT,
  content_hash TEXT,          -- SHA-256 hash
  content_type TEXT,
  content_length INT,
  estimated_tokens INT,       -- LLM token estimate
  access_count INT,           -- Total accesses
  bot_access_count INT,       -- Bot accesses only
  first_seen_at TIMESTAMP,
  last_seen_at TIMESTAMP,
  UNIQUE (tenant_id, host, path, content_hash)
);
```

**Why deduplication matters:**

If GPTBot requests `/api-docs` 1,000 times but the content hasn't changed (same ETag/hash), you served:
- **Transport volume**: 45 MB (1,000 × 45 KB)
- **Unique content**: 45 KB (deduplicated)

The unique content is what matters for licensing value.

### 3. Estimate Semantic Tokens

```typescript
function estimateTokens(contentType: string, bytes: number): number {
  // HTML/Text: ~4 characters per token
  if (contentType.includes('text/') || contentType.includes('html')) {
    return Math.ceil(bytes / 4);
  }

  // Images: ~765 tokens per image (GPT-4V average)
  if (contentType.includes('image/')) {
    return 765;
  }

  // PDFs: ~500 tokens per page (~50KB/page)
  if (contentType.includes('pdf')) {
    const pages = Math.ceil(bytes / 50000);
    return pages * 500;
  }

  // Conservative estimate for other formats
  return Math.ceil(bytes / 10);
}
```

**Token-to-value mapping:**
- Industry licensing deals: ~$0.000001 per token
- Example: 10M tokens = ~$10 estimated value

---

## API Endpoints

### 1. Get Data Footprint Summary

```http
GET /v1/data-footprint?period=month
```

**Response:**

```json
{
  "period": {
    "start": "2024-10-01T00:00:00Z",
    "end": "2024-11-01T00:00:00Z"
  },
  "summary": {
    "totalBytes": 1234567890,
    "totalBytesFormatted": "1.15 GB",
    "totalRequests": 45320,
    "uniqueResources": 1250,
    "uniqueBytes": 52428800,
    "uniqueBytesFormatted": "50.00 MB",
    "estimatedTokens": 13107200,
    "estimatedTokensFormatted": "13,107,200",
    "estimatedValue": 13.11,
    "estimatedValueFormatted": "$13.11"
  },
  "byCrawler": [
    {
      "crawlerFamily": "gptbot",
      "bytes": 523456789,
      "bytesFormatted": "499.18 MB",
      "requests": 18234,
      "uniqueResources": 487,
      "estimatedTokens": 5242880,
      "estimatedTokensFormatted": "5,242,880",
      "estimatedValue": 5.24,
      "estimatedValueFormatted": "$5.24"
    },
    {
      "crawlerFamily": "claudebot",
      "bytes": 312345678,
      "bytesFormatted": "297.83 MB",
      "requests": 12456,
      "uniqueResources": 423,
      "estimatedTokens": 3145728,
      "estimatedTokensFormatted": "3,145,728",
      "estimatedValue": 3.15,
      "estimatedValueFormatted": "$3.15"
    }
  ],
  "topResources": [
    {
      "path": "/api-docs",
      "contentType": "text/html",
      "bytes": 45123,
      "bytesFormatted": "44.07 KB",
      "accessCount": 1523,
      "botAccessCount": 982,
      "estimatedTokens": 11280,
      "estimatedTokensFormatted": "11,280"
    }
  ]
}
```

### 2. Get Data Footprint Timeline

```http
GET /v1/data-footprint/timeline?period=month
```

**Response:**

```json
{
  "period": {
    "start": "2024-10-01T00:00:00Z",
    "end": "2024-11-01T00:00:00Z"
  },
  "timeline": [
    {
      "date": "2024-10-01",
      "requests": 1234,
      "bytes": 52428800,
      "bytesFormatted": "50.00 MB",
      "uniqueResources": 45
    },
    {
      "date": "2024-10-02",
      "requests": 1456,
      "bytes": 62914560,
      "bytesFormatted": "60.00 MB",
      "uniqueResources": 52
    }
  ]
}
```

### 3. Get Crawler-Specific Data

```http
GET /v1/data-footprint/crawler/gptbot?period=month
```

**Response:**

```json
{
  "crawlerFamily": "gptbot",
  "period": {
    "start": "2024-10-01T00:00:00Z",
    "end": "2024-11-01T00:00:00Z"
  },
  "summary": {
    "totalBytes": 523456789,
    "totalBytesFormatted": "499.18 MB",
    "totalRequests": 18234,
    "uniqueResources": 487
  },
  "topPaths": [
    { "path": "/api-docs", "requests": 1234 },
    { "path": "/tutorials", "requests": 982 },
    { "path": "/blog", "requests": 654 }
  ],
  "recentEvents": [
    {
      "ts": "2024-10-31T23:59:45Z",
      "path": "/api-docs",
      "bytes": 45123,
      "bytesFormatted": "44.07 KB",
      "contentType": "text/html"
    }
  ]
}
```

---

## Dashboard Integration

### Data Footprint Card

```tsx
import { Card } from '@/components/ui/card';
import { formatBytes, formatTokens, formatCurrency } from '@/lib/data-footprint';

export function DataFootprintCard({ metrics }: { metrics: DataFootprintMetrics }) {
  return (
    <Card>
      <h3>Data Footprint (Last 30 Days)</h3>

      <div className="grid grid-cols-3 gap-4">
        <Stat
          label="Total Data Served"
          value={formatBytes(metrics.totalBytes)}
          subtext={`${metrics.totalRequests.toLocaleString()} requests`}
        />

        <Stat
          label="Unique Content"
          value={formatBytes(metrics.uniqueBytes)}
          subtext={`${metrics.uniqueResources} resources`}
        />

        <Stat
          label="Estimated Value"
          value={formatCurrency(metrics.estimatedValue)}
          subtext={`${formatTokens(metrics.estimatedTokens)} tokens`}
        />
      </div>

      <h4>By Crawler Family</h4>
      <table>
        <thead>
          <tr>
            <th>Crawler</th>
            <th>Data Served</th>
            <th>Unique Content</th>
            <th>Est. Value</th>
          </tr>
        </thead>
        <tbody>
          {metrics.byCrawler.map(c => (
            <tr key={c.crawlerFamily}>
              <td>{c.crawlerFamily}</td>
              <td>{formatBytes(c.bytes)}</td>
              <td>{c.uniqueResources} resources</td>
              <td>{formatCurrency(c.estimatedValue)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
```

---

## Use Cases

### 1. Publishers: Quantify Scraping Activity

**Scenario:** NYT wants to know how much content OpenAI scraped.

**Originary Trace provides:**
```
GPTBot Activity (Oct 2024):
  - Total data served: 2.3 GB
  - Unique articles: 15,482
  - Estimated tokens: 575M
  - Estimated licensing value: $575

Top scraped sections:
  - /world: 450M tokens ($450)
  - /technology: 75M tokens ($75)
  - /opinion: 50M tokens ($50)
```

**Action:** Use this data in licensing negotiations with OpenAI.

### 2. API Providers: Identify Unauthorized Usage

**Scenario:** API provider wants to see if bots are consuming API without payment.

**Originary Trace provides:**
```
Anthropic Bot (ClaudeBot) Activity:
  - Endpoint: /api/v2/search
  - Data served: 120 MB
  - Requests: 45,000
  - Est. value: $30/mo

Policy: train=no (ignored)
Status: ⚠️ Violation detected
```

**Action:** Contact Anthropic to negotiate API access terms.

### 3. Documentation Sites: Estimate Training Contribution

**Scenario:** Open-source project wants to see if their docs are being used for training.

**Originary Trace provides:**
```
AI Crawler Summary (All Time):
  - Total documentation pages: 1,250
  - Scraped by: GPTBot, ClaudeBot, Gemini
  - Total tokens: 3.2M
  - Est. contribution to LLM training: $3.20

Recommendation: Add peac.txt with train=ask
```

### 4. Legal Teams: Evidence for Licensing

**Scenario:** Legal team needs verifiable evidence for licensing negotiation.

**Originary Trace provides:**
```
Monthly Compliance Bundle (November 2024):
  ├── data-footprint.json
  │   ├── totalBytes: 1234567890
  │   ├── uniqueResources: 1250
  │   ├── estimatedTokens: 13107200
  │   └── byCrawler: [...]
  ├── violations.csv (policy-ignored events)
  └── signature.jws (Ed25519 signed)

Verified by: JWKS public key
Audit hash: d8f7a2b1c3e4...
```

---

## Accuracy & Limitations

### What We Track Accurately

✅ **Transport volume** (exact bytes served)
- Captured from Content-Length headers
- 100% accurate for responses with Content-Length
- Cloudflare Logpush provides `EdgeResponseBytes` (exact)

✅ **Unique resources** (via SHA-256 deduplication)
- Exact count of distinct content versions
- Detects when content changes (new hash)

### What We Estimate

⚠️ **Semantic tokens** (estimated, not exact)
- Rule of thumb: ~4 chars/token for text
- Actual tokenization varies by model (GPT-4, Claude, Gemini use different tokenizers)
- For precise counts, use model-specific tokenizers (tiktoken, claude-tokenizer)

⚠️ **Licensing value** (rough estimate)
- Based on industry benchmarks (~$0.000001/token)
- Actual licensing deals vary widely
- Use as starting point for negotiations, not final price

### Limitations

❌ **Cannot track if content was actually used for training**
- We only know what was served, not what was used
- Some bots may fetch but not train (e.g., search indexing)

❌ **Hashing large files may be skipped**
- Worker hashes responses under 10MB
- Larger files tracked by bytes only (no hash)

❌ **Dynamic content may generate new hashes**
- Timestamps in HTML → different hash each request
- Use ETags for better deduplication

---

## Configuration

### Enable Data Footprint Tracking

**Cloudflare Worker (Automatic):**
```typescript
// Already enabled in apps/worker/src/index.ts
// Hashes responses under 10MB for bot requests
```

**Nginx (Manual - Add to config):**
```nginx
log_format peac escape=json '{'
  '"ts":"$msec",'
  '"host":"$host",'
  '"path":"$request_uri",'
  '"method":"$request_method",'
  '"status":$status,'
  '"ua":"$http_user_agent",'
  '"response_bytes":$body_bytes_sent,'
  '"content_type":"$content_type",'
  '"etag":"$sent_http_etag"'
'}';

access_log /var/log/nginx/peac.log peac;
```

Then run the Go tailer:
```bash
./trace-tailer -file=/var/log/nginx/peac.log
```

**Cloudflare Logpush:**
```json
{
  "EdgeResponseBytes": 45123,
  "EdgeResponseContentType": "text/html",
  "CacheStatus": "HIT"
}
```

---

## Database Schema

### CrawlEvent (Updated)

```prisma
model CrawlEvent {
  // ... existing fields ...

  // Data Footprint fields
  responseBytes  Int?    @map("response_bytes")
  contentType    String? @map("content_type")
  etag           String?
  resourceHash   String? @map("resource_hash") // SHA-256

  @@index([resourceHash])
}
```

### Resource (New)

```prisma
model Resource {
  id               String   @id @default(cuid())
  tenantId         String
  host             String
  path             String
  contentHash      String   @map("content_hash") // SHA-256
  contentType      String?  @map("content_type")
  contentLength    Int      @map("content_length")
  estimatedTokens  Int?     @map("estimated_tokens")
  firstSeenAt      DateTime @map("first_seen_at") @default(now())
  lastSeenAt       DateTime @map("last_seen_at") @default(now())
  accessCount      Int      @default(0) @map("access_count")
  botAccessCount   Int      @default(0) @map("bot_access_count")

  @@unique([tenantId, host, path, contentHash])
  @@index([tenantId, lastSeenAt])
  @@index([contentHash])
}
```

---

## Migration

Run Prisma migration to add new fields:

```bash
cd apps/api
npx prisma migrate dev --name add-data-footprint
npx prisma generate
```

---

## Roadmap

### ✅ Completed (Current Release)

1. Database schema (resources table + new fields)
2. Event ingestion (capture response metadata)
3. Resource deduplication (SHA-256 hashing)
4. Token estimation (basic heuristics)
5. API endpoints (summary, timeline, by-crawler)
6. Cloudflare Worker integration (hash responses)

### 🔄 Next (High Priority)

1. **Dashboard UI** - Data Footprint card with charts
2. **Compliance Bundle** - Include Data Footprint in monthly ZIP
3. **Nginx integration** - Extract response_bytes from logs
4. **Token refinement** - Use model-specific tokenizers
5. **Value calculator** - Scenario analysis for licensing

### 📅 Later (Week 2-3)

6. **Site inventory job** - Crawl site to pre-populate resources
7. **Change detection** - Alert when bot scrapes new content
8. **Comparative reports** - "GPTBot scraped 2× more than last month"
9. **CSV export** - Download Data Footprint as CSV
10. **Webhooks** - Alert when thresholds exceeded

---

## FAQ

### Q: How accurate are the token estimates?

**A:** For text content, ~90% accurate compared to actual tokenizers. For images/PDFs, it's a rough estimate. Use model-specific tokenizers for precise counts.

### Q: Why track transport volume AND unique content?

**A:** Transport shows total bandwidth cost. Unique content shows licensing value. If GPTBot fetches the same page 1000 times, you paid for 1000× bandwidth but only 1× content was "scraped."

### Q: Can I use this for licensing negotiations?

**A:** Yes! The estimated value is based on industry benchmarks. Use it as a starting point, but verify with legal counsel for actual licensing terms.

### Q: What if my content changes frequently?

**A:** Use ETags for better deduplication. Originary Trace will track different versions as separate resources (correct behavior for dynamic content).

### Q: Does this work with Cloudflare's free plan?

**A:** Yes! The Worker hashes responses directly. For Logpush (Enterprise only), you get exact EdgeResponseBytes from Cloudflare's logs.

---

## Related Documentation

- [WHY_TRACE.md](WHY_TRACE.md) - Overall positioning
- [POSITIONING_UPDATES.md](POSITIONING_UPDATES.md) - Strategic changes
- [INTEGRATION_GUIDE.md](INTEGRATION_GUIDE.md) - Integration methods
- [API Reference](../apps/api/README.md) - Full API docs

---

**Built to quantify what AI bots scrape. Not just who visited, but what they took.**
