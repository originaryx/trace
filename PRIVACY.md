# Privacy Policy

## Overview

Originary Trace is designed with privacy as a core principle. When self-hosted, you have complete control over your data.

## Data Collection (Self-Hosted OSS)

When you self-host Originary Trace, **you** control all data collection and storage. We (Originary) do not collect, access, or have visibility into your data.

### What is Stored Locally

- **Event data**: HTTP request metadata (timestamp, path, method, status, user-agent)
- **IP addresses**: Only the /24 prefix is stored (e.g., `192.168.1.0/24` instead of `192.168.1.123`)
- **Content hashes**: SHA-256 hashes of resources for deduplication
- **No personal data**: No cookies, no tracking, no personal information

### What is NOT Stored

- ❌ Full IP addresses
- ❌ Request/response bodies (unless explicitly configured)
- ❌ Cookies or session data
- ❌ Personal information
- ❌ Authentication credentials (only encrypted API keys)

## Respect for User Privacy

### Do Not Track (DNT)

Originary Trace respects the `DNT` (Do Not Track) browser header:

```http
DNT: 1
```

If DNT is enabled, events are not recorded.

### Global Privacy Control (GPC)

We also respect the `Sec-GPC` header:

```http
Sec-GPC: 1
```

This provides users with a standardized way to opt out of data collection.

## WordPress Plugin

The WordPress plugin:

- Batches events non-blockingly
- Respects DNT and GPC headers
- Does not use cookies
- Does not track user behavior
- Only records bot/crawler metadata

## Cloudflare Worker

The Cloudflare Worker:

- Proxies requests without modification
- Emits metadata to your API endpoint
- Does not log request/response bodies
- Respects DNT/GPC if configured

## Data Retention

By default, Originary Trace stores events indefinitely. You control retention:

```sql
-- Delete events older than 90 days
DELETE FROM CrawlEvent WHERE ts < NOW() - INTERVAL '90 days';
```

Consider setting up automated cleanup:

```bash
# Cron job for 90-day retention
0 0 * * * psql $DATABASE_URL -c "DELETE FROM CrawlEvent WHERE ts < NOW() - INTERVAL '90 days';"
```

## GDPR Compliance

Originary Trace is designed to be GDPR-compatible:

1. **Data minimization**: Only stores necessary metadata
2. **IP anonymization**: Only /24 prefix stored
3. **Right to deletion**: `/v1/gdpr/delete` endpoint
4. **Data export**: `/export/csv` and `/export/json` endpoints
5. **Compliance bundles**: Verifiable proof of compliance

### GDPR Endpoints

```bash
# Request data deletion for a domain
DELETE /v1/gdpr/delete?domain=example.com

# Export data for a domain
GET /export/csv?domain=example.com
```

## Third-Party Services

### Self-Hosted (OSS)

When self-hosting, **no** data is sent to Originary or any third party.

### Originary Trace Cloud (Optional)

If you use the managed Trace Cloud service:

- We collect the same metadata as OSS
- We do not sell or share data with third parties
- We use industry-standard encryption (TLS 1.3, AES-256)
- We comply with GDPR, CCPA, and SOC 2 requirements
- See our full Cloud Privacy Policy at: https://trace.originary.xyz/privacy

## Data Security

- **Encryption in transit**: TLS 1.3
- **Encryption at rest**: AES-256-GCM for secrets, database-level encryption recommended
- **Authentication**: HMAC-SHA256 signatures
- **Rate limiting**: Protection against abuse
- **No telemetry**: OSS version does not phone home

## Children's Privacy

Originary Trace does not knowingly collect information from children under 13.

## Changes to Privacy Policy

We may update this privacy policy. Check this file for the latest version.

## Contact

For privacy questions:

**Email**: privacy@originary.xyz

---

*Last updated: 2025-11-09*
