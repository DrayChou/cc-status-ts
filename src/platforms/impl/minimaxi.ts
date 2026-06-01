/**
 * Minimaxi 平台实现
 * 参考 Python cc-status 的实现，KFC 风格显示
 * 适配 coding_plan/remains 新接口：返回 model_name (general/video) + remaining_percent
 */
import type { BalanceFetcher, BalanceResult } from '../base.js';

export const platform = 'minimaxi';

const API_BASE = 'https://www.minimaxi.com/v1/api';

interface ModelRemains {
  model_name: string;
  start_time: number;
  end_time: number;
  remains_time: number;
  current_interval_total_count: number;
  current_interval_usage_count: number;
  current_interval_status: number;
  current_interval_remaining_percent: number;
  current_weekly_total_count: number;
  current_weekly_usage_count: number;
  current_weekly_status: number;
  current_weekly_remaining_percent: number;
  weekly_start_time: number;
  weekly_end_time: number;
  weekly_remains_time: number;
}

interface MinimaxiResponse {
  base_resp?: {
    status_code: number;
    status_msg?: string;
  };
  model_remains?: ModelRemains[];
}

function formatTimestamp(timestamp: number): string {
  if (!timestamp || timestamp <= 0) {
    return '(NoReset)';
  }

  try {
    const date = new Date(timestamp);
    const now = new Date();

    const month = date.getMonth() + 1;
    const day = date.getDate();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');

    if (date.getFullYear() === now.getFullYear() &&
        date.getMonth() === now.getMonth() &&
        day === now.getDate()) {
      // Today - show only time
      return `(${hours}:${minutes})`;
    } else {
      // Other dates show MM-DD HH:MM
      return `(${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')} ${hours}:${minutes})`;
    }
  } catch {
    return '(Err)';
  }
}

async function fetchBalance(authToken: string | undefined, _baseUrl: string | undefined): Promise<BalanceResult> {
  if (!authToken) {
    throw new Error('No auth token');
  }

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

  // Find 'general' model (coding plan main quota); fallback to first model
  let codingModel = modelRemains.find(m => m.model_name === 'general');
  if (!codingModel) {
    codingModel = modelRemains[0];
  }

  // New API only returns remaining percentage; absolute counts are 0
  const intervalPct = codingModel.current_interval_remaining_percent ?? 0;
  const weeklyPct = codingModel.current_weekly_remaining_percent ?? 0;

  // Format timestamps
  const intervalReset = formatTimestamp(codingModel.end_time);
  const weeklyReset = formatTimestamp(codingModel.weekly_end_time);

  // Color based on interval remaining percentage
  const color: 'green' | 'yellow' | 'red' =
    intervalPct <= 10 ? 'red' : intervalPct <= 30 ? 'yellow' : 'green';

  // KFC style: 5h:97%(reset)|wk:99%(weekly_reset) — minimaxi interval 是 5h 窗口,与 KFC 一致
  const display = `5h:${intervalPct}%${intervalReset}|wk:${weeklyPct}%${weeklyReset}`;

  return {
    platform,
    balance: intervalPct,
    currency: 'CNY',
    display,
    color,
    raw_data: data,
  };
}

export const fetcher: BalanceFetcher = {
  platform,
  fetch: fetchBalance,
};
