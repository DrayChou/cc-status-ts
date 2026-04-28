/**
 * xai.ainaibahub 平台实现
 */
import type { BalanceFetcher, BalanceResult } from '../base.js';

export const platform = 'xai.ainaibahub';

const API_BASE = 'https://api-xai.ainaibahub.com';
const NO_EXPIRY = '0001-01-01T00:00:00Z';

interface CreditBalanceItem {
  amount?: number;
  balance?: number;
  reference?: string;
  granted_at?: string;
  expires_at?: string;
}

interface UsageMetrics {
  CreditUsed?: number;
}

interface XaiAinaibahubResponse {
  balance?: number;
  daily_limit?: number;
  rpd?: number;
  tpd?: number;
  requests?: number;
  daily_usage?: UsageMetrics;
  monthly_usage?: UsageMetrics & {
    Prompt?: number;
  };
  credit_balance?: CreditBalanceItem[];
}

interface ActivePackageSummary {
  totalAmount: number;
  usedAmount: number;
  remainingAmount: number;
  earliestExpiry: string | null;
}

async function fetchBalance(authToken: string | undefined, baseUrl: string | undefined): Promise<BalanceResult> {
  if (!authToken) {
    throw new Error('No auth token');
  }

  const url = `${baseUrl || API_BASE}/dashboard/live`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Accept': 'application/json, text/plain, */*',
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  const data = await response.json() as XaiAinaibahubResponse;

  const balance = toNumber(data.balance);
  const dailyLimit = toNumber(data.daily_limit);
  const dailyUsed = toNumber(data.daily_usage?.CreditUsed);
  const rpdLimit = toNumber(data.rpd);
  const rpdUsed = toNumber(data.requests);
  const tpdLimit = toNumber(data.tpd);
  const tpdUsed = toNumber(data.monthly_usage?.Prompt);
  const packageSummary = summarizeActivePackages(data.credit_balance || []);

  const displayParts = [`¥${formatAmount(balance, 0)}`];

  if (dailyLimit > 0) {
    displayParts.push(`day:${formatAmount(dailyUsed, 0)}/${formatAmount(dailyLimit, 0)}`);
  }

  if (rpdLimit > 0) {
    displayParts.push(`rpd:${formatInteger(rpdUsed)}/${formatCompactInt(rpdLimit)}`);
  }

  if (tpdLimit > 0) {
    displayParts.push(`tpd:${formatCompactAmount(tpdUsed)}/${formatScientificLimit(tpdLimit)}`);
  }

  if (packageSummary.totalAmount > 0) {
    displayParts.push(`pkg:${formatAmount(packageSummary.usedAmount, 0)}/${formatAmount(packageSummary.totalAmount, 0)}`);
  }

  if (packageSummary.earliestExpiry) {
    displayParts.push(`exp:${formatExpiry(packageSummary.earliestExpiry)}`);
  }

  return {
    platform,
    balance,
    currency: 'CNY',
    display: displayParts.join('|'),
    color: getUsageColor(dailyUsed, dailyLimit, rpdUsed, rpdLimit),
    raw_data: {
      ...data,
      package_summary: packageSummary,
    },
  };
}

function summarizeActivePackages(packages: CreditBalanceItem[]): ActivePackageSummary {
  const activePackages = packages.filter((item) => {
    const expiresAt = item.expires_at;
    return !!expiresAt && expiresAt !== NO_EXPIRY && toNumber(item.amount) > 0;
  });

  let totalAmount = 0;
  let remainingAmount = 0;
  let earliestExpiry: string | null = null;

  for (const item of activePackages) {
    const amount = toNumber(item.amount);
    const remaining = Math.max(0, toNumber(item.balance));
    totalAmount += amount;
    remainingAmount += remaining;

    if (!earliestExpiry || new Date(item.expires_at as string).getTime() < new Date(earliestExpiry).getTime()) {
      earliestExpiry = item.expires_at || null;
    }
  }

  return {
    totalAmount,
    usedAmount: Math.max(0, totalAmount - remainingAmount),
    remainingAmount,
    earliestExpiry,
  };
}

function getUsageColor(dailyUsed: number, dailyLimit: number, rpdUsed: number, rpdLimit: number): 'green' | 'yellow' | 'red' {
  const dailyPercent = percentage(dailyUsed, dailyLimit);
  const rpdPercent = percentage(rpdUsed, rpdLimit);
  const maxPercent = Math.max(dailyPercent, rpdPercent);

  if (maxPercent >= 90) return 'red';
  if (maxPercent >= 70) return 'yellow';
  return 'green';
}

function percentage(used: number, limit: number): number {
  if (limit <= 0) {
    return 0;
  }
  return (used / limit) * 100;
}

function toNumber(value: number | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function formatAmount(value: number, fractionDigits: number): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value);
}

function formatInteger(value: number): string {
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 0,
  }).format(value);
}

function formatCompactInt(value: number): string {
  if (value >= 1000000000) {
    return `${(value / 1000000000).toFixed(0)}B`;
  }
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(0)}M`;
  }
  if (value >= 1000) {
    const compact = value / 1000;
    return Number.isInteger(compact) ? `${compact.toFixed(0)}k` : `${compact.toFixed(1)}k`;
  }
  return formatInteger(value);
}

function formatCompactAmount(value: number): string {
  if (value >= 1000000000) {
    return `${(value / 1000000000).toFixed(2)}B`;
  }
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}k`;
  }
  return formatInteger(value);
}

function formatScientificLimit(value: number): string {
  if (value >= 1000000000) {
    return '1B';
  }
  return formatCompactInt(value);
}

function formatExpiry(expiresAt: string): string {
  const date = new Date(expiresAt);
  if (Number.isNaN(date.getTime())) {
    return expiresAt;
  }
  return `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export const fetcher: BalanceFetcher = {
  platform,
  fetch: fetchBalance,
};
