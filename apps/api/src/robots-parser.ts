/**
 * Robots.txt and PEAC policy parser with violation tracking
 *
 * This is Originary Trace's key differentiator:
 * We don't just track bots, we track POLICY COMPLIANCE and generate verifiable evidence.
 */

import robotsParser from 'robots-parser';

const cache = new Map<string, { expiresAt: number; parser: any }>();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

export interface PeacPolicy {
  access: 'allowed' | 'disallowed';
  train: 'yes' | 'no' | 'ask';
  retain?: string; // e.g., "7d", "30d", "never"
  license?: string;
  payment?: string;
}

export interface PolicyViolation {
  type: 'robots_disallow' | 'peac_train_no' | 'peac_access_disallowed';
  severity: 'high' | 'medium' | 'low';
  message: string;
  evidence: any;
}

/**
 * Check if a path is disallowed for a given user agent according to robots.txt
 * Caches robots.txt for 24 hours
 */
export async function isDisallowed(
  domain: string,
  path: string,
  userAgent: string
): Promise<boolean> {
  const url = `https://${domain}/robots.txt`;
  const now = Date.now();

  // Check cache
  const cached = cache.get(url);
  if (cached && cached.expiresAt > now) {
    return !cached.parser.isAllowed(path, userAgent);
  }

  // Fetch robots.txt
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'OriginaryTrace/0.1' },
      signal: AbortSignal.timeout(5000),
    });

    const text = response.ok ? await response.text() : '';
    const parser = robotsParser(url, text || '');

    // Cache the parser
    cache.set(url, { expiresAt: now + CACHE_TTL, parser });

    return !parser.isAllowed(path, userAgent);
  } catch (error) {
    // If we can't fetch robots.txt, assume allowed
    console.warn(`Failed to fetch robots.txt for ${domain}:`, error);
    return false;
  }
}

/**
 * Parse PEAC policy from peac.txt content
 */
export function parsePeacPolicy(content: string): PeacPolicy {
  const policy: PeacPolicy = {
    access: 'allowed',
    train: 'ask'
  };

  const lines = content.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const [key, ...valueParts] = trimmed.split(':');
    const value = valueParts.join(':').trim();

    switch (key.toLowerCase()) {
      case 'access':
        if (value === 'allowed' || value === 'disallowed') {
          policy.access = value;
        }
        break;
      case 'train':
        if (value === 'yes' || value === 'no' || value === 'ask') {
          policy.train = value;
        }
        break;
      case 'retain':
        policy.retain = value;
        break;
      case 'license':
        policy.license = value;
        break;
      case 'payment':
        policy.payment = value;
        break;
    }
  }

  return policy;
}

/**
 * Check for policy violations
 * Returns array of violations (empty if compliant)
 */
export async function checkPolicyViolations(
  domain: string,
  path: string,
  crawlerFamily: string,
  userAgent: string,
  peacPolicy?: PeacPolicy
): Promise<PolicyViolation[]> {
  const violations: PolicyViolation[] = [];

  // Check robots.txt violations
  try {
    const disallowed = await isDisallowed(domain, path, userAgent);

    if (disallowed) {
      violations.push({
        type: 'robots_disallow',
        severity: 'high',
        message: `Path "${path}" is disallowed for ${crawlerFamily} in robots.txt`,
        evidence: {
          path,
          crawlerFamily,
          userAgent,
          source: 'robots.txt'
        }
      });
    }
  } catch (error) {
    // Silently ignore robots.txt check errors
  }

  // Check PEAC policy violations
  if (peacPolicy) {
    // Check access policy
    if (peacPolicy.access === 'disallowed') {
      violations.push({
        type: 'peac_access_disallowed',
        severity: 'high',
        message: `Access disallowed by PEAC policy for ${crawlerFamily}`,
        evidence: {
          crawlerFamily,
          policy: peacPolicy,
          source: 'peac.txt'
        }
      });
    }

    // Check training policy
    if (peacPolicy.train === 'no') {
      violations.push({
        type: 'peac_train_no',
        severity: 'medium',
        message: `Training prohibited by PEAC policy, but ${crawlerFamily} may be collecting data`,
        evidence: {
          crawlerFamily,
          policy: peacPolicy,
          source: 'peac.txt'
        }
      });
    }
  }

  return violations;
}

/**
 * Generate policy summary for dashboard
 */
export function generatePolicySummary(violations: PolicyViolation[]): {
  compliant: boolean;
  violationCount: number;
  severity: 'high' | 'medium' | 'low' | 'none';
  message: string;
} {
  if (violations.length === 0) {
    return {
      compliant: true,
      violationCount: 0,
      severity: 'none',
      message: 'All crawlers are compliant with policy'
    };
  }

  const hasHigh = violations.some(v => v.severity === 'high');
  const hasMedium = violations.some(v => v.severity === 'medium');

  return {
    compliant: false,
    violationCount: violations.length,
    severity: hasHigh ? 'high' : hasMedium ? 'medium' : 'low',
    message: `${violations.length} policy violation(s) detected`
  };
}

/**
 * Clear robots.txt cache
 */
export function clearRobotsCache(): void {
  cache.clear();
}
