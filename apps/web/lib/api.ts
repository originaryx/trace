const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787';

export interface StatsResponse {
  bots: number;
  total: number;
}

export interface EventsResponse {
  events: Array<{
    id: string;
    ts: string;
    host: string;
    path: string;
    method: string;
    ua: string;
    isBot: boolean;
    crawlerFamily: string;
    source: string;
  }>;
  total: number;
}

export interface CrawlerStats {
  crawlerFamily: string;
  count: number;
  percentage: number;
}

export interface PathStats {
  path: string;
  total: number;
  bots: number;
  percentage: number;
}

export interface TimeSeriesPoint {
  timestamp: string;
  bots: number;
  humans: number;
  total: number;
}

/**
 * Fetch public stats for a tenant
 */
export async function fetchStats(tenant: string): Promise<StatsResponse> {
  const response = await fetch(`${API_URL}/v1/public/stats?tenant=${encodeURIComponent(tenant)}`);

  if (!response.ok) {
    throw new Error(`Failed to fetch stats: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Fetch crawler breakdown by family
 * Currently returns demo data for UI development
 * Production: Connect to GET /v1/stats/crawlers endpoint
 */
export async function fetchCrawlerStats(_tenant: string): Promise<CrawlerStats[]> {
  // Demo data for UI development
  // Production: Replace with API client call
  return [
    { crawlerFamily: 'gptbot', count: 250, percentage: 25 },
    { crawlerFamily: 'claudebot', count: 180, percentage: 18 },
    { crawlerFamily: 'googlebot', count: 150, percentage: 15 },
    { crawlerFamily: 'bingbot', count: 100, percentage: 10 },
    { crawlerFamily: 'unknown-bot', count: 70, percentage: 7 },
    { crawlerFamily: 'humanish', count: 250, percentage: 25 },
  ];
}

/**
 * Mock function to fetch path statistics
 */
export async function fetchPathStats(_tenant: string): Promise<PathStats[]> {
  // Mock data for demonstration
  return [
    { path: '/', total: 500, bots: 200, percentage: 40 },
    { path: '/docs', total: 300, bots: 180, percentage: 60 },
    { path: '/api', total: 200, bots: 150, percentage: 75 },
    { path: '/pricing', total: 150, bots: 50, percentage: 33 },
    { path: '/blog', total: 100, bots: 30, percentage: 30 },
  ];
}

/**
 * Mock function to fetch time series data
 */
export async function fetchTimeSeries(tenant: string, days: number = 7): Promise<TimeSeriesPoint[]> {
  // Mock data for demonstration
  const data: TimeSeriesPoint[] = [];
  const now = Date.now();

  for (let i = days - 1; i >= 0; i--) {
    const timestamp = new Date(now - i * 24 * 60 * 60 * 1000).toISOString();
    data.push({
      timestamp,
      bots: Math.floor(Math.random() * 100) + 50,
      humans: Math.floor(Math.random() * 100) + 50,
      total: 0, // Will be calculated
    });
  }

  // Calculate totals
  data.forEach((point) => {
    point.total = point.bots + point.humans;
  });

  return data;
}
