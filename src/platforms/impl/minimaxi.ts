/**
 * Minimaxi 平台实现
 * 参考 Python cc-status 的实现
 */
import type { BalanceFetcher, BalanceResult } from '../base.js';

export const platform = 'minimaxi';

const API_BASE = 'https://www.minimaxi.com/v1/api';

interface MinimaxiResponse {
  base_resp?: {
    status_code: number;
    status_msg?: string;
  };
  model_remains?: Array<{
    model_name: string;
    current_interval_total_count: number;
    current_interval_usage_count: number;
    remains_time: number;
    end_time: number;
  }>;
}

async function fetchBalance(authToken: string | undefined, _baseUrl: string | undefined): Promise<BalanceResult> {
  if (!authToken) {
    throw new Error('No auth token');
  }

  // First call: get usage data
  const usageUrl = `${API_BASE}/openplatform/coding_plan/remains`;

  const headers = {
    'accept': 'application/json, text/plain, */*',
    'accept-language': 'en,zh-CN;q=0.9,zh-TW;q=0.7,zh;q=0.6,en-US;q=0.5',
    'authorization': `Bearer ${authToken}`,
    'dnt': '1',
    'origin': 'https://platform.minimaxi.com',
    'priority': 'u=1, i',
    'referer': 'https://platform.minimaxi.com/',
    'sec-ch-ua': '"Chromium";v="142", "Google Chrome";v="142", "Not_A Brand";v="99"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"macOS"',
    'sec-fetch-dest': 'empty',
    'sec-fetch-mode': 'cors',
    'sec-fetch-site': 'same-site',
    'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',
  };

  const response = await fetch(usageUrl, {
    method: 'GET',
    headers,
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  const data = await response.json() as MinimaxiResponse;

  if (data.base_resp?.status_code !== 0) {
    return {
      platform,
      balance: 0,
      currency: 'CNY',
      display: data.base_resp?.status_msg || `API${data.base_resp?.status_code || 'Error'}`,
      raw_data: data,
    };
  }

  const modelRemains = data.model_remains;
  if (!modelRemains || modelRemains.length === 0) {
    return {
      platform,
      balance: 0,
      currency: 'CNY',
      display: 'NoUsage',
      raw_data: data,
    };
  }

  // Get first model's data
  const primary = modelRemains[0];
  const totalCount = primary.current_interval_total_count;
  const usedCount = primary.current_interval_usage_count;
  const endTime = primary.end_time;

  // Calculate remaining (used count is what we have left based on API naming)
  const remainingCount = usedCount;
  const remainingPct = totalCount > 0 ? (remainingCount / totalCount) * 100 : 0;

  // Calculate reset time
  let resetShort = 'Unknown';

  if (endTime > 0) {
    const resetDate = new Date(endTime);
    resetShort = `${String(resetDate.getMonth() + 1).padStart(2, '0')}-${String(resetDate.getDate()).padStart(2, '0')} ${String(resetDate.getHours()).padStart(2, '0')}:${String(resetDate.getMinutes()).padStart(2, '0')}`;
  }

  // Color based on remaining percentage (remaining is good, depletion is bad)
  const usageColor: 'green' | 'yellow' | 'red' = remainingPct <= 10 ? 'red' : remainingPct <= 30 ? 'yellow' : 'green';

  const display = `${remainingCount}/${totalCount}(${resetShort})`;

  return {
    platform,
    balance: remainingCount,
    currency: 'CNY',
    display,
    color: usageColor,
    raw_data: data,
  };
}

export const fetcher: BalanceFetcher = {
  platform,
  fetch: fetchBalance,
};
