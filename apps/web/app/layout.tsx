import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Navigation } from '@/components/Navigation';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Originary Trace - Distributed Tracing for Your Content',
  description: 'See which AI companies crawl your site — and what it\'s worth.',
  keywords: ['originary', 'trace', 'AI crawlers', 'PEAC protocol', 'content tracing', 'compliance'],
  authors: [{ name: 'Originary' }],
  openGraph: {
    title: 'Originary Trace - Distributed Tracing for Your Content',
    description: 'Distributed tracing for your content. Track AI crawler compliance with PEAC Protocol.',
    type: 'website',
    url: 'https://trace.originary.xyz',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <div className="min-h-screen bg-gray-50">
          <Navigation />
          <main>{children}</main>
        </div>
      </body>
    </html>
  );
}
