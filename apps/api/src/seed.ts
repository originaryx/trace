import { PrismaClient } from '@prisma/client';
import { randomBytes } from 'crypto';
import { encryptSecret } from './hmac-secrets.js';

const prisma = new PrismaClient();

const CRAWLER_FAMILIES: Array<[string, number]> = [
  ['gptbot', 20],
  ['claudebot', 15],
  ['googlebot', 12],
  ['bingbot', 8],
  ['unknown-bot', 5],
  ['humanish', 40],
];

const PATHS = ['/', '/docs', '/api', '/pricing', '/blog', '/about'];

function pickWeighted(items: Array<[string, number]>): string {
  const total = items.reduce((sum, [, weight]) => sum + weight, 0);
  let random = Math.random() * total;

  for (const [item, weight] of items) {
    random -= weight;
    if (random <= 0) return item;
  }

  return items[0][0];
}

async function main() {
  console.log('🌱 Seeding database...');

  // Create or update demo tenant
  const tenant = await prisma.tenant.upsert({
    where: { domain: 'example.com' },
    update: {},
    create: {
      name: 'Example Corp',
      domain: 'example.com',
    },
  });

  console.log(`✅ Tenant: ${tenant.name} (${tenant.domain})`);

  // Create API key
  const rawSecret = randomBytes(32).toString('base64');
  const encryptedSecret = encryptSecret(rawSecret);

  const apiKey = await prisma.apiKey.upsert({
    where: { id: tenant.id }, // Use tenant ID as stable key ID for demo
    update: { secret: encryptedSecret },
    create: {
      id: tenant.id,
      tenantId: tenant.id,
      name: 'Default API Key',
      secret: encryptedSecret,
    },
  });

  console.log(`✅ API Key created`);
  console.log(`   ID: ${apiKey.id}`);
  console.log(`   Secret: ${rawSecret}`);
  console.log(`   (Store this secret securely!)`);

  // Create demo user
  const user = await prisma.user.upsert({
    where: { email: 'demo@example.com' },
    update: {},
    create: {
      email: 'demo@example.com',
      name: 'Demo User',
    },
  });

  // Create membership
  await prisma.membership.upsert({
    where: {
      userId_tenantId: {
        userId: user.id,
        tenantId: tenant.id,
      },
    },
    update: {},
    create: {
      userId: user.id,
      tenantId: tenant.id,
      role: 'owner',
    },
  });

  console.log(`✅ User: ${user.email} (owner)`);

  // Generate 1000 sample events
  console.log('📊 Generating 1000 sample events...');

  const now = Date.now();
  const events: any[] = [];

  for (let i = 0; i < 1000; i++) {
    const family = pickWeighted(CRAWLER_FAMILIES);
    const isBot = family !== 'humanish';
    const path = PATHS[Math.floor(Math.random() * PATHS.length)];

    // Vary timestamp over last 7 days
    const ts = new Date(now - Math.random() * 7 * 24 * 60 * 60 * 1000);

    const ua =
      family === 'gptbot'
        ? 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.0; +https://openai.com/gptbot)'
        : family === 'claudebot'
          ? 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; ClaudeBot/1.0; +https://www.anthropic.com)'
          : family === 'googlebot'
            ? 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
            : family === 'bingbot'
              ? 'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)'
              : family === 'unknown-bot'
                ? 'curl/8.0.1'
                : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0';

    events.push({
      tenantId: tenant.id,
      ts,
      host: 'example.com',
      path,
      method: 'GET',
      status: Math.random() > 0.95 ? 404 : 200,
      ua,
      ipPrefix: isBot ? '8.8.8.0/24' : '203.0.113.0/24',
      isBot,
      crawlerFamily: family,
      source: 'seed',
      bytes: Math.floor(Math.random() * 50000) + 1000,
      reqTimeMs: Math.floor(Math.random() * 500) + 10,
    });
  }

  await prisma.crawlEvent.createMany({ data: events });

  console.log(`✅ Created 1000 sample events`);

  // Summary stats
  const totalEvents = await prisma.crawlEvent.count({ where: { tenantId: tenant.id } });
  const botEvents = await prisma.crawlEvent.count({
    where: { tenantId: tenant.id, isBot: true },
  });
  const botPercentage = Math.round((botEvents / totalEvents) * 100);

  console.log('\n📈 Summary:');
  console.log(`   Total events: ${totalEvents}`);
  console.log(`   Bot events: ${botEvents} (${botPercentage}%)`);
  console.log(`   Human events: ${totalEvents - botEvents}`);

  console.log('\n✨ Seed complete!');
  console.log('\n🚀 Quick start:');
  console.log(`   1. Start API: pnpm --filter @originary/trace-api run dev`);
  console.log(`   2. Test event:
      curl -X POST http://localhost:8787/v1/events \\
        -H "Content-Type: application/json" \\
        -H "X-Peac-Key: ${apiKey.id}" \\
        -H "X-Peac-Timestamp: ${Date.now()}" \\
        -H "X-Peac-Signature: <hmac>" \\
        -d '{"host":"example.com","path":"/test","method":"GET","ua":"curl/8"}'
   `);
}

main()
  .catch((error) => {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
