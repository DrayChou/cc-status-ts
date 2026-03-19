/**
 * GLM 平台实现
 * 参考 Python cc-status 的实现
 */
import type { BalanceFetcher, BalanceResult } from '../base.js';

export const platform = 'glm';

const API_BASE = 'https://bigmodel.cn/api';

interface GLMQuotaResponse {
  code: number;
  data?: {
    limits?: Array<{
      type: string;
      unit?: number;
      number?: number;
      usage?: number;
      currentValue?: number;
      remaining?: number;
      percentage?: number;
      nextResetTime?: number;
    }>;
    level?: string;
  };
  msg?: string;
}

interface GLMSubscriptionResponse {
  code: number;
  data?: Array<{
    status: string;
    inCurrentPeriod: boolean;
    nextRenewTime?: string;
    productName?: string;
  }>;
  msg?: string;
}

async function fetchBalance(authToken: string | undefined, _baseUrl: string | undefined): Promise<BalanceResult> {
  if (!authToken) {
    throw new Error('No auth token');
  }

  const quotaUrl = `${API_BASE}/monitor/usage/quota/limit`;
  const subscriptionUrl = `${API_BASE}/biz/subscription/list?pageSize=9999&pageNum=1`;

  const headers = {
    'accept': 'application/json, text/plain, */*',
    'accept-language': 'zh',
    'authorization': `Bearer ${authToken}`,
    'cache-control': 'no-cache',
    'pragma': 'no-cache',
    'priority': 'u=1, i',
    'referer': 'https://bigmodel.cn/finance-center/subscribe-manage',
    'sec-ch-ua': '"Chromium";v="142", "Microsoft Edge";v="142", "Not_A Brand";v="99"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"macOS"',
    'sec-fetch-dest': 'empty',
    'sec-fetch-mode': 'cors',
    'sec-fetch-site': 'same-origin',
    'set-language': 'zh',
    'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36 Edg/142.0.0.0',
  };

  // Fetch quota and subscription in parallel
  const [quotaRes, subRes] = await Promise.all([
    fetch(quotaUrl, { method: 'GET', headers }),
    fetch(subscriptionUrl, { method: 'GET', headers }),
  ]);

  if (!quotaRes.ok) {
    throw new Error(`API error: ${quotaRes.status}`);
  }

  const quotaData = await quotaRes.json() as GLMQuotaResponse;
  const subData = await subRes.json() as GLMSubscriptionResponse;
  const rawData = { quota: quotaData, subscription: subData };

  if (quotaData.code !== 200) {
    return {
      platform,
      balance: 0,
      currency: 'CNY',
      display: `API${quotaData.code || 'Error'}`,
      raw_data: rawData,
    };
  }

  // Parse quota data - check TOKENS_LIMIT first (like Python does)
  let totalQuota = 0;
  let remaining = 0;
  let nextResetTime = 0;
  let percentage: number | undefined;
  let unit: number | undefined;
  let number: number | undefined;
  let foundTokensLimit = false;

  const limits = quotaData.data?.limits || [];

  // Python checks TOKENS_LIMIT first - for many accounts it only has percentage
  for (const limit of limits) {
    if (limit.type === 'TOKENS_LIMIT') {
      foundTokensLimit = true;
      // API fields: usage=total quota, currentValue=used, remaining=remaining
      totalQuota = limit.usage || 0;
      remaining = limit.remaining || 0;
      nextResetTime = limit.nextResetTime || 0;
      percentage = limit.percentage;
      unit = limit.unit;
      number = limit.number;
      break;
    }
  }

  // Only check TIME_LIMIT if no TOKENS_LIMIT was found (Python behavior)
  if (!foundTokensLimit) {
    for (const limit of limits) {
      if (limit.type === 'TIME_LIMIT' && limit.remaining !== undefined) {
        totalQuota = limit.usage || 0;
        remaining = limit.remaining || 0;
        nextResetTime = limit.nextResetTime || 0;
        percentage = limit.percentage;
        break;
      }
    }
  }

  // Get subscription display for expiry - format as MM-DD (like Python)
  let subscriptionDisplay = '';
  const subscriptions = subData.data || [];
  for (const sub of subscriptions) {
    if (sub.status === 'VALID' && sub.inCurrentPeriod) {
      if (sub.nextRenewTime) {
        // sub.nextRenewTime is like "2026-04-04T00:00:00"
        const renewDate = new Date(sub.nextRenewTime);
        const renewShort = `${String(renewDate.getMonth() + 1).padStart(2, '0')}-${String(renewDate.getDate()).padStart(2, '0')}`;
        subscriptionDisplay = ` [${renewShort}]`;
      }
      break;
    }
  }

  // Format reset time
  let resetShort = 'Unknown';
  if (nextResetTime > 0) {
    const resetDate = new Date(nextResetTime);
    resetShort = `${String(resetDate.getMonth() + 1).padStart(2, '0')}-${String(resetDate.getDate()).padStart(2, '0')} ${String(resetDate.getHours()).padStart(2, '0')}:${String(resetDate.getMinutes()).padStart(2, '0')}`;
  }

  // Calculate remaining percentage for color (remaining is good, depletion is bad)
  // Python: remaining_pct = 100 - usage_pct (percentage), so remaining = 100 - 11 = 89%
  const usagePct = totalQuota > 0 ? (remaining / totalQuota) * 100 : (percentage || 0);
  const remainingPct = 100 - usagePct;
  const usageColor: 'green' | 'yellow' | 'red' = remainingPct <= 10 ? 'red' : remainingPct <= 30 ? 'yellow' : 'green';

  // Format display
  let display: string;
  if (totalQuota > 0) {
    // Has detailed data: remaining/total(reset_time)
    const remainingStr = formatNumber(remaining);
    const totalStr = formatNumber(totalQuota);
    display = `${remainingStr}/${totalStr}(${resetShort})`;
  } else if (percentage !== undefined) {
    // Fallback to percentage mode: percentage%/period(reset_time)
    let periodInfo = '';
    if (unit !== undefined && number !== undefined) {
      const unitName = unit === 3 ? 'h' : unit === 5 ? 'm' : '?';
      periodInfo = `/${number}${unitName}`;
    }
    display = `${percentage}%${periodInfo}`;
    if (resetShort !== 'Unknown') {
      display += `(${resetShort})`;
    }
  } else {
    display = 'NoData';
  }

  display += subscriptionDisplay;

  return {
    platform,
    balance: remaining || (percentage || 0),
    currency: 'CNY',
    display,
    color: usageColor,
    raw_data: rawData,
  };
}

function formatNumber(num: number): string {
  if (num >= 1000000000) {
    return `${(num / 1000000000).toFixed(1)}B`;
  } else if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`;
  } else if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`;
  }
  return `${num}`;
}

export const fetcher: BalanceFetcher = {
  platform,
  fetch: fetchBalance,
};
