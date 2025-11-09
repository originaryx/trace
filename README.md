# Originary Trace

> **Distributed tracing for your content. See which AI services accessed your site and what they took.**

[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)
[![Built on PEAC](https://img.shields.io/badge/Built%20on-PEAC%20Protocol-blue)](https://github.com/peacprotocol/peac)
[![GitHub](https://img.shields.io/github/stars/originaryx/trace?style=social)](https://github.com/originaryx/trace)

Originary Trace is a **reference implementation** of the [PEAC Protocol](https://github.com/peacprotocol/peac) for content tracing and compliance. It demonstrates policy discovery (`/.well-known/peac.txt`), verifiable receipts (`PEAC-Receipt` headers), and HTTP 402 semantics for the agentic web.

**[📖 Documentation](https://trace.originary.xyz/docs)** | **[💬 Discussions](https://github.com/originaryx/trace/discussions)** | **[🐛 Issues](https://github.com/originaryx/trace/issues)**

---

## 🎯 What is Originary Trace?

Originary Trace helps you:

- **Track** which AI crawlers (GPTBot, ClaudeBot, Google-Extended, etc.) access your content
- **Quantify** data footprint (bytes served, estimated tokens, licensing value)
- **Enforce** policy compliance (robots.txt + PEAC policy violations)
- **Generate** verifiable receipts for compliance and licensing
- **Export** compliance bundles for legal/audit purposes

### Built on PEAC Protocol

[PEAC (Programmable Environment for Agent Coordination)](https://github.com/peacprotocol/peac) is an open protocol for machine-readable policy and agent coordination on the web.

Originary Trace implements:
- ✅ `/.well-known/peac.txt` policy discovery
- ✅ `PEAC-Receipt` header generation (JWS-signed)
- ✅ `/v1/verify` endpoint for receipt verification
- ✅ `/.well-known/jwks.json` public key distribution
- ✅ Compliance tracking and violation detection

## 🆚 OSS vs Cloud

| Feature | **Trace OSS** (Self-Hosted) | **Trace Cloud** (Managed) |
|---------|------------------------------|---------------------------|
| **Deployment** | Docker, Cloudflare Worker, Kubernetes | Fully managed SaaS |
| **Ingest API** | ✅ NDJSON/JSON/Array | ✅ Enterprise-grade |
| **Data Retention** | 30 days (configurable) | 90d / 1yr / Custom |
| **PEAC Receipts** | ✅ Self-managed keys | ✅ Attested + KMS |
| **Compliance Bundles** | CSV/JSON export | Automated signed ZIPs |
| **Multi-property** | 1 instance per site | Unlimited, cross-site rollups |
| **Alerts** | Manual check | Email/Slack/webhook |
| **SSO/SCIM** | ❌ | ✅ Enterprise auth |
| **Benchmarking** | ❌ | ✅ Compare vs peers |
| **Support** | Community | SLA + dedicated |

**OSS is complete** — everything you need for a single property. Cloud adds operations, scale, and attestation.

[→ Compare pricing](https://trace.originary.xyz/pricing)

## 🚀 Quick Start

### Option 1: Docker Compose (Recommended)

```bash
# Clone the repository
git clone https://github.com/originaryx/trace.git
cd trace

# Configure environment
cp apps/api/.env.example apps/api/.env
# Edit .env with your database credentials

# Start services
docker-compose up -d

# Run migrations and seed demo data
pnpm --filter @originary/trace-api run prisma:migrate
pnpm run seed
```

API available at: http://localhost:8787  
Docs available at: http://localhost:8787/docs

### Option 2: Cloudflare Worker (Serverless)

```bash
# Install Wrangler CLI
npm install -g wrangler

# Deploy Worker
cd apps/worker
wrangler deploy --env production
```

Configure `TRACE_API_URL` in your Worker settings to point to your API instance.

### Option 3: One-Click Deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/originaryx/trace)
[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/originaryx/trace)

## 📦 Architecture

```
┌─────────────────┐
│  Your Website   │
└────────┬────────┘
         │
    ┌────▼─────────────────────────────────┐
    │ Cloudflare Worker / Nginx Tailer    │ (Optional)
    │ Emits events on each request        │
    └────┬─────────────────────────────────┘
         │
    ┌────▼────────────────────────────┐
    │  Originary Trace API            │
    │  - Ingests events (NDJSON/JSON) │
    │  - Generates PEAC receipts      │
    │  - Tracks compliance violations │
    └────┬────────────────────────────┘
         │
    ┌────▼─────────┬──────────────────┐
    │  PostgreSQL  │      Redis       │
    │  (Events)    │  (Rate Limiting) │
    └──────────────┴──────────────────┘
```

## 🔧 Integrations

### Cloudflare Worker

Deploy the included Worker to automatically track all requests:

```bash
cd apps/worker
wrangler deploy
```

The Worker:
- Proxies requests without modification
- Emits metadata to your Trace API
- Adds `PEAC-Policy` and `Link: /.well-known/peac.txt` headers
- Respects DNT/GPC

### Nginx Log Tailer

Stream Nginx access logs to Trace:

```bash
cd apps/tailer
go build -o trace-tailer
./trace-tailer --api-url=https://trace.yourdomain.com
```

### WordPress Plugin

Install the WordPress plugin for automatic tracking:

```bash
# Download plugin
cd packages/wordpress
zip -r originary-trace.zip .

# Upload to WordPress
# wp-admin → Plugins → Add New → Upload
```

Plugin respects DNT/GPC and batches events non-blockingly.

## 📊 Data Footprint Tracking

Originary Trace automatically calculates:

- **Bytes served**: Total content served to crawlers
- **Unique resources**: Deduplicated by SHA-256 hash
- **Estimated tokens**: `bytes / 4` (GPT tokenization estimate)
- **Licensing value**: `tokens * $0.000001` (rough estimate)

Example output:

```json
{
  "uniqueResources": 1247,
  "totalBytes": 52428800,
  "estimatedTokens": 13107200,
  "estimatedValue": "$13.11 USD"
}
```

## 🛡️ PEAC Compliance

### Policy File: `/.well-known/peac.txt`

```
access: allowed
train: no
retain: 7d
license: https://example.com/license
payment: https://example.com/pricing
```

### Receipt Header: `PEAC-Receipt`

```http
PEAC-Receipt: eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9...
```

JWS-signed receipt containing:
- Request metadata
- Policy decision
- Timestamp
- Signature (Ed25519)

### Verification

```bash
curl -X POST https://trace.yourdomain.com/v1/verify \
  -H "Content-Type: application/json" \
  -d '{"receipt": "eyJhbGci..."}'
```

## 📡 Public Badge

Show compliance transparency with a public badge:

```html
<img src="https://trace.yourdomain.com/public/badge/yourdomain.com.svg" 
     alt="Crawler Compliance" />
```

Displays:
- ✅ `compliant` (green) if no violations
- ⚠️ `X violations` (yellow/red) if policy breaches detected

## 🔐 Privacy & Security

Originary Trace is designed with privacy as a core principle:

- **IP anonymization**: Only /24 prefix stored (e.g., `192.168.1.0/24`)
- **No cookies**: No tracking cookies or user profiling
- **DNT/GPC respect**: Honors Do Not Track and Global Privacy Control headers
- **Encryption**: HMAC-SHA256 authentication, AES-256-GCM secrets at rest
- **No telemetry**: OSS version does not phone home

See [PRIVACY.md](PRIVACY.md) for full details.

## 🤝 Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

Quick links:
- **Bug reports**: [GitHub Issues](https://github.com/originaryx/trace/issues)
- **Feature requests**: [GitHub Discussions](https://github.com/originaryx/trace/discussions)
- **Security**: [SECURITY.md](SECURITY.md)

## 📜 License

Originary Trace is licensed under [Apache-2.0](LICENSE).

**Trademarks**: "Originary" and "Originary Trace" are trademarks of Originary. See [TRADEMARKS.md](TRADEMARKS.md) for usage guidelines.

## 🌐 Links

- **Website**: https://trace.originary.xyz
- **PEAC Protocol**: https://github.com/peacprotocol/peac
- **Originary**: https://www.originary.xyz
- **Documentation**: https://trace.originary.xyz/docs
- **Community**: https://github.com/originaryx/trace/discussions

## 💡 Use Cases

### Publishers & Content Creators
- Track which AI models are training on your articles
- Quantify licensing value of scraped content
- Generate compliance bundles for licensing negotiations

### Enterprise & Legal
- Audit AI crawler activity across all properties
- Generate signed compliance evidence for legal teams
- Enforce custom PEAC policies per domain

### Developers & SaaS
- Add crawler analytics to your product
- Implement PEAC Protocol in your stack
- Build on top of verifiable receipts

---

**Built with ❤️ by [Originary](https://www.originary.xyz)**

**Powered by [PEAC Protocol](https://github.com/peacprotocol/peac)** — An open standard for the agentic web.
