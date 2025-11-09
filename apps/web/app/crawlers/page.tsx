'use client';

import { useEffect, useState } from 'react';
import { fetchCrawlerStats, type CrawlerStats } from '@/lib/api';

export default function CrawlersPage() {
  const [crawlers, setCrawlers] = useState<CrawlerStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const data = await fetchCrawlerStats('example.com');
        setCrawlers(data);
      } catch (error) {
        console.error('Failed to load crawlers:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  if (loading) {
    return <div className="p-8">Loading...</div>;
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="mb-6 text-3xl font-bold text-gray-900">Crawlers</h1>

      <div className="overflow-hidden bg-white shadow sm:rounded-lg">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Crawler Family
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
            {crawlers.map((crawler) => (
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
    </div>
  );
}
