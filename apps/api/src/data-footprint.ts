/**
 * Data Footprint Tracking
 *
 * Tracks how much data AI bots have scraped:
 * - Transport volume (exact bytes served)
 * - Unique content (SHA-256 deduplication)
 * - Semantic tokens (estimated LLM tokens)
 */

/**
 * Estimate LLM tokens from content
 * Rule of thumb: ~4 characters per token for English text
 * More accurate for actual token counting would require tiktoken library
 */
export function estimateTokens(contentType: string, bytes: number): number {
  // HTML/Text: ~4 chars per token
  if (contentType.includes('text/') || contentType.includes('html') || contentType.includes('json')) {
    return Math.ceil(bytes / 4);
  }

  // Images: Use vision model token estimates
  // GPT-4V uses ~765 tokens per image on average
  if (contentType.includes('image/')) {
    return 765;
  }

  // PDFs: Estimate based on average page size (~500 tokens/page, ~50KB/page)
  if (contentType.includes('pdf')) {
    const estimatedPages = Math.ceil(bytes / 50000);
    return estimatedPages * 500;
  }

  // Other binary formats: Conservative estimate
  return Math.ceil(bytes / 10);
}

/**
 * Calculate value per token
 * Based on typical LLM training costs and licensing benchmarks
 */
export function estimateValuePerToken(): number {
  // Conservative estimate: $0.000001 per token
  // Based on industry licensing deals and training costs
  return 0.000001;
}

/**
 * Aggregate Data Footprint metrics
 */
export interface DataFootprintMetrics {
  // Transport metrics
  totalBytes: number;
  totalRequests: number;

  // Content metrics
  uniqueResources: number;
  uniqueBytes: number;

  // Semantic metrics
  estimatedTokens: number;
  estimatedValue: number;

  // Per-crawler breakdown
  byCrawler: {
    crawlerFamily: string;
    bytes: number;
    requests: number;
    uniqueResources: number;
    estimatedTokens: number;
    estimatedValue: number;
  }[];

  // Top resources
  topResources: {
    path: string;
    contentType: string;
    bytes: number;
    accessCount: number;
    botAccessCount: number;
    estimatedTokens: number;
  }[];
}

/**
 * Query Data Footprint for a tenant
 */
export async function getDataFootprint(
  prisma: any,
  tenantId: string,
  startDate: Date,
  endDate: Date
): Promise<DataFootprintMetrics> {
  // Get all bot events in date range
  const events = await prisma.crawlEvent.findMany({
    where: {
      tenantId,
      ts: { gte: startDate, lte: endDate },
      isBot: true,
    },
    select: {
      crawlerFamily: true,
      responseBytes: true,
      resourceHash: true,
      contentType: true,
      path: true,
    },
  });

  // Calculate transport volume
  const totalBytes = events.reduce((sum: number, e: any) => sum + (e.responseBytes || 0), 0);
  const totalRequests = events.length;

  // Calculate unique resources
  const uniqueHashes = new Set(events.filter((e: any) => e.resourceHash).map((e: any) => e.resourceHash));
  const uniqueResources = uniqueHashes.size;

  // Get unique bytes and tokens from resources table
  const resources = await prisma.resource.findMany({
    where: {
      tenantId,
      lastSeenAt: { gte: startDate, lte: endDate },
    },
    select: {
      path: true,
      contentType: true,
      contentLength: true,
      estimatedTokens: true,
      accessCount: true,
      botAccessCount: true,
    },
  });

  const uniqueBytes = resources.reduce((sum: number, r: any) => sum + r.contentLength, 0);
  const estimatedTokens = resources.reduce((sum: number, r: any) => sum + (r.estimatedTokens || 0), 0);
  const estimatedValue = estimatedTokens * estimateValuePerToken();

  // Per-crawler breakdown
  const crawlerMap = new Map<string, any>();

  for (const event of events) {
    const family = event.crawlerFamily || 'unknown';

    if (!crawlerMap.has(family)) {
      crawlerMap.set(family, {
        crawlerFamily: family,
        bytes: 0,
        requests: 0,
        uniqueHashes: new Set(),
        estimatedTokens: 0,
      });
    }

    const crawler = crawlerMap.get(family);
    crawler.bytes += event.responseBytes || 0;
    crawler.requests += 1;

    if (event.resourceHash) {
      crawler.uniqueHashes.add(event.resourceHash);
    }

    if (event.contentType && event.responseBytes) {
      crawler.estimatedTokens += estimateTokens(event.contentType, event.responseBytes);
    }
  }

  const byCrawler = Array.from(crawlerMap.values()).map((c: any) => ({
    crawlerFamily: c.crawlerFamily,
    bytes: c.bytes,
    requests: c.requests,
    uniqueResources: c.uniqueHashes.size,
    estimatedTokens: c.estimatedTokens,
    estimatedValue: c.estimatedTokens * estimateValuePerToken(),
  }));

  // Sort by bytes descending
  byCrawler.sort((a, b) => b.bytes - a.bytes);

  // Top resources by bot access
  const topResources = resources
    .filter((r: any) => r.botAccessCount > 0)
    .sort((a: any, b: any) => b.botAccessCount - a.botAccessCount)
    .slice(0, 50)
    .map((r: any) => ({
      path: r.path,
      contentType: r.contentType || 'unknown',
      bytes: r.contentLength,
      accessCount: r.accessCount,
      botAccessCount: r.botAccessCount,
      estimatedTokens: r.estimatedTokens || 0,
    }));

  return {
    totalBytes,
    totalRequests,
    uniqueResources,
    uniqueBytes,
    estimatedTokens,
    estimatedValue,
    byCrawler,
    topResources,
  };
}

/**
 * Format bytes for display
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

/**
 * Format currency
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Format tokens with thousands separator
 */
export function formatTokens(tokens: number): string {
  return new Intl.NumberFormat('en-US').format(Math.round(tokens));
}
