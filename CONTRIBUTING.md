# Contributing to Originary Trace

Thank you for your interest in contributing to Originary Trace! This document provides guidelines and instructions for contributing.

## Code of Conduct

By participating in this project, you agree to abide by our [Code of Conduct](CODE_OF_CONDUCT.md).

## Ways to Contribute

- 🐛 **Bug reports**: Report bugs via GitHub Issues
- ✨ **Feature requests**: Suggest new features via GitHub Discussions
- 📝 **Documentation**: Improve docs, add examples, fix typos
- 🔧 **Code**: Fix bugs, implement features, improve performance
- 🧪 **Testing**: Add tests, improve test coverage
- 🌍 **Translations**: Help translate documentation

## Getting Started

### Prerequisites

- Node.js ≥20.0.0 LTS
- pnpm ≥9.0.0
- PostgreSQL ≥14
- Redis (optional, for rate limiting)

### Setup

1. Fork the repository
2. Clone your fork:
   ```bash
   git clone https://github.com/YOUR_USERNAME/trace.git
   cd trace
   ```

3. Install dependencies:
   ```bash
   pnpm install
   ```

4. Set up environment:
   ```bash
   cp apps/api/.env.example apps/api/.env
   # Edit .env with your database credentials
   ```

5. Run database migrations:
   ```bash
   pnpm --filter @originary/trace-api run prisma:migrate
   ```

6. Seed demo data:
   ```bash
   pnpm run seed
   ```

7. Start development server:
   ```bash
   pnpm run dev
   ```

   API runs at: http://localhost:8787
   Web app runs at: http://localhost:3000

### Project Structure

```
trace/
├── apps/
│   ├── api/          # Fastify API server
│   ├── web/          # Next.js dashboard
│   └── worker/       # Cloudflare Worker
├── packages/
│   ├── signer/       # Ed25519 signing utilities
│   └── widget/       # Public badge widget
├── scripts/          # Utility scripts
└── docs/             # Documentation
```

## Development Workflow

### 1. Create a Branch

```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/bug-description
```

### 2. Make Changes

- Write clean, readable code
- Follow existing code style
- Add tests for new features
- Update documentation

### 3. Run Tests

```bash
# Type check
pnpm run typecheck

# Build
pnpm run build

# Tests
pnpm run test

# OSS validation
pnpm run validate
```

### 4. Commit

We use conventional commits:

```bash
git commit -m "feat: add crawler verification endpoint"
git commit -m "fix: handle NDJSON parsing edge case"
git commit -m "docs: update API documentation"
```

**Commit types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation only
- `style`: Code style (formatting, semicolons, etc.)
- `refactor`: Code refactoring
- `perf`: Performance improvement
- `test`: Adding or updating tests
- `chore`: Build process, dependencies, etc.

### 5. Push and Create PR

```bash
git push origin your-branch-name
```

Then create a Pull Request on GitHub.

## Pull Request Guidelines

### PR Title

Use conventional commit format:

```
feat: add support for custom PEAC policies
fix: resolve race condition in event ingestion
docs: improve Cloudflare Worker setup guide
```

### PR Description

Include:

- **What**: What does this PR do?
- **Why**: Why is this change needed?
- **How**: How does it work?
- **Testing**: How was it tested?
- **Screenshots**: If UI changes

### Example

```markdown
## What

Adds support for custom PEAC policy validation in the event ingestion endpoint.

## Why

Users need to enforce custom PEAC policies beyond robots.txt.

## How

- Parses `/.well-known/peac.txt` for each domain
- Caches policy for 24 hours
- Validates crawler behavior against policy
- Records violations

## Testing

- Added unit tests for policy parser
- Added integration test for violation detection
- Manually tested with demo site

## Breaking Changes

None
```

## Code Style

### TypeScript

- Use TypeScript strict mode
- Prefer `const` over `let`
- Use explicit types for public APIs
- Avoid `any` (use `unknown` if needed)

### Formatting

We use Prettier:

```bash
pnpm run format
```

### Linting

```bash
pnpm run lint
```

## Testing

### Unit Tests

```typescript
import { describe, it, expect } from 'vitest';

describe('PEAC Policy Parser', () => {
  it('should parse valid policy', () => {
    const policy = parsePeacPolicy('access: allowed\ntrain: no');
    expect(policy.access).toBe('allowed');
    expect(policy.train).toBe('no');
  });
});
```

### Integration Tests

Test actual API endpoints:

```typescript
describe('POST /v1/events', () => {
  it('should ingest valid event', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/v1/events',
      headers: {
        'Content-Type': 'application/json',
        'X-Peac-Key': apiKey.id,
        'X-Peac-Signature': hmac,
      },
      payload: { host: 'example.com', path: '/', method: 'GET' },
    });

    expect(response.statusCode).toBe(202);
  });
});
```

## Documentation

- Update README.md for user-facing changes
- Add JSDoc comments for public APIs
- Update OpenAPI spec if API changes
- Add examples to `docs/` for complex features

## PEAC Protocol Compliance

When modifying PEAC-related code:

1. Ensure compliance with [PEAC Protocol spec](https://github.com/peacprotocol/peac)
2. Test interoperability with `@peac/sdk`
3. Update PEAC-related documentation
4. Keep JWKS endpoint up-to-date

## Questions?

- **GitHub Discussions**: https://github.com/originaryx/trace/discussions
- **Discord**: (coming soon)
- **Email**: contribute@originary.xyz

Thank you for contributing! 🎉

---

*Last updated: 2025-11-09*
