'use client';

import { useEffect, useState } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { format } from 'date-fns';
import {
  fetchStats,
  fetchCrawlerStats,
  fetchPathStats,
  fetchTimeSeries,
  type StatsResponse,
  type CrawlerStats,
  type PathStats,
  type TimeSeriesPoint,
} from '@/lib/api';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82ca9d'];

export default function Dashboard() {
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [crawlerStats, setCrawlerStats] = useState<CrawlerStats[]>([]);
  const [pathStats, setPathStats] = useState<PathStats[]>([]);
  const [timeSeries, setTimeSeries] = useState<TimeSeriesPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const tenant = 'example.com'; // Demo mode - production: integrate auth provider

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const [statsData, crawlerData, pathData, timeSeriesData] = await Promise.all([
          fetchStats(tenant),
          fetchCrawlerStats(tenant),
          fetchPathStats(tenant),
          fetchTimeSeries(tenant, 7),
        ]);

        setStats(statsData);
        setCrawlerStats(crawlerData);
        setPathStats(pathData);
        setTimeSeries(timeSeriesData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [tenant]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-lg text-gray-600">Loading dashboard...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-lg text-red-600">Error: {error}</div>
      </div>
    );
  }

  if (!stats) {
    return null;
  }

  const botPercentage = stats.total > 0 ? Math.round((stats.bots / stats.total) * 100) : 0;
  const humanPercentage = 100 - botPercentage;

  // Revenue potential calculation (example: $5 per 1000 bot requests)
  const pricePerThousand = 5;
  const revenuePotential = (stats.bots / 1000) * pricePerThousand;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-2 text-sm text-gray-600">
          Monitor your bot traffic and estimate revenue potential
        </p>
      </div>

      {/* Stats Cards */}
      <div className="mb-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard title="Total Requests" value={stats.total.toLocaleString()} />
        <StatsCard
          title="Bot Requests"
          value={stats.bots.toLocaleString()}
          subtitle={`${botPercentage}%`}
          trend="up"
        />
        <StatsCard
          title="Human Requests"
          value={(stats.total - stats.bots).toLocaleString()}
          subtitle={`${humanPercentage}%`}
        />
        <StatsCard
          title="Revenue Potential"
          value={`$${revenuePotential.toFixed(2)}`}
          subtitle="@ $5/1k requests"
        />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        {/* Time Series Chart */}
        <ChartCard title="Traffic Over Time (7 Days)">
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={timeSeries}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="timestamp"
                tickFormatter={(value) => format(new Date(value), 'MM/dd')}
              />
              <YAxis />
              <Tooltip
                labelFormatter={(value) => format(new Date(value as string), 'MMM dd, yyyy')}
              />
              <Legend />
              <Line type="monotone" dataKey="bots" stroke="#FF8042" name="Bot Traffic" />
              <Line type="monotone" dataKey="humans" stroke="#0088FE" name="Human Traffic" />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Crawler Distribution Pie Chart */}
        <ChartCard title="Bot Traffic by Crawler">
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={crawlerStats}
                dataKey="count"
                nameKey="crawlerFamily"
                cx="50%"
                cy="50%"
                outerRadius={100}
                label={(entry) => `${entry.crawlerFamily} (${entry.percentage}%)`}
              >
                {crawlerStats.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Top Paths Bar Chart */}
        <ChartCard title="Top Paths by Bot Traffic">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={pathStats}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="path" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="bots" fill="#FF8042" name="Bot Requests" />
              <Bar dataKey="total" fill="#0088FE" name="Total Requests" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Crawler Table */}
        <ChartCard title="Crawler Breakdown">
          <div className="overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Crawler
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Requests
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Percentage
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {crawlerStats.map((crawler) => (
                  <tr key={crawler.crawlerFamily}>
                    <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                      {crawler.crawlerFamily}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                      {crawler.count.toLocaleString()}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                      {crawler.percentage}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ChartCard>
      </div>
    </div>
  );
}

function StatsCard({
  title,
  value,
  subtitle,
  trend,
}: {
  title: string;
  value: string;
  subtitle?: string;
  trend?: 'up' | 'down';
}) {
  return (
    <div className="overflow-hidden rounded-lg bg-white px-4 py-5 shadow sm:p-6">
      <dt className="truncate text-sm font-medium text-gray-500">{title}</dt>
      <dd className="mt-1 flex items-baseline justify-between md:block lg:flex">
        <div className="flex items-baseline text-2xl font-semibold text-gray-900">
          {value}
          {subtitle && (
            <span className="ml-2 text-sm font-medium text-gray-500">{subtitle}</span>
          )}
        </div>
        {trend && (
          <div
            className={`inline-flex items-baseline rounded-full px-2.5 py-0.5 text-sm font-medium md:mt-2 lg:mt-0 ${
              trend === 'up'
                ? 'bg-green-100 text-green-800'
                : 'bg-red-100 text-red-800'
            }`}
          >
            {trend === 'up' ? '↑' : '↓'}
          </div>
        )}
      </dd>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-lg bg-white shadow">
      <div className="px-4 py-5 sm:p-6">
        <h3 className="mb-4 text-lg font-medium leading-6 text-gray-900">{title}</h3>
        {children}
      </div>
    </div>
  );
}
