# Security Policy

## Supported Versions

We release patches for security vulnerabilities in the following versions:

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

Instead, please report them via email to:

**security@originary.xyz**

You should receive a response within 48 hours. If for some reason you do not, please follow up via email to ensure we received your original message.

Please include the following information:

- Type of issue (e.g., buffer overflow, SQL injection, cross-site scripting, etc.)
- Full paths of source file(s) related to the manifestation of the issue
- The location of the affected source code (tag/branch/commit or direct URL)
- Any special configuration required to reproduce the issue
- Step-by-step instructions to reproduce the issue
- Proof-of-concept or exploit code (if possible)
- Impact of the issue, including how an attacker might exploit it

## Coordinated Disclosure

We follow coordinated disclosure:

1. **Report received**: We'll acknowledge your email within 48 hours
2. **Investigation**: We'll investigate and confirm the vulnerability
3. **Fix development**: We'll develop a fix in a private repository
4. **Release**: We'll release the fix and a security advisory
5. **Public disclosure**: After 90 days, or when a fix is available, whichever comes first

## Bug Bounty

We currently do not offer a paid bug bounty program, but we will publicly acknowledge security researchers who responsibly disclose vulnerabilities (with your permission).

## Security Best Practices

When self-hosting Originary Trace:

1. **Keep secrets safe**: Use environment variables for all secrets (API keys, database credentials)
2. **Use HTTPS**: Always use HTTPS in production
3. **Keep dependencies updated**: Run `pnpm update` regularly
4. **Limit CORS origins**: Configure `CORS_ALLOW_ORIGINS` to specific domains
5. **Enable rate limiting**: Configure rate limits in production
6. **Rotate keys**: Regularly rotate API keys and signing keys
7. **Monitor logs**: Watch for unusual access patterns
8. **Run behind a proxy**: Use Cloudflare, Nginx, or similar for additional protection

## Known Security Considerations

### HMAC Authentication

- HMAC signatures use SHA-256
- Timestamp skew tolerance: ±5 minutes
- Replay protection: 5-minute nonce cache in Redis

### Ed25519 Signing

- Self-managed keys in OSS version
- Private keys should be stored securely (environment variables, secret management systems)
- Rotate signing keys quarterly or after suspected compromise

### Database Security

- API keys are encrypted at rest with AES-256-GCM
- Use a strong `API_SECRET_MASTER_KEY` (32+ random bytes)
- Database credentials should never be committed to version control

### Rate Limiting

- Default: 1000 requests per minute per IP
- Configurable per tenant
- Uses Redis for distributed rate limiting

## Security Updates

Subscribe to security updates:

- **GitHub**: Watch this repository for security advisories
- **Email**: Subscribe at security@originary.xyz

---

*Last updated: 2025-11-09*
