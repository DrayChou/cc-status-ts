/**
 * DeepSeek 平台实现
 * 参考 Python cc-status 的实现
 */
import type { BalanceFetcher, BalanceResult } from '../base.js';

export const platform = 'deepseek';

const API_BASE = 'https://api.deepseek.com';

interface DeepSeekResponse {
  is_available: boolean;
  balance_infos: Array<{
    currency: string;
    total_balance: string;
  }>;
}

async function fetchBalance(apiKey: string | undefined, _baseUrl: string | undefined): Promise<BalanceResult> {
  if (!apiKey) {
    throw new Error('No API key');
  }

  const url = `${API_BASE}/user/balance`;

  const headers = {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };

  const response = await fetch(url, {
    method: 'GET',
    headers,
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  const data = await response.json() as DeepSeekResponse;

  if (!data.balance_infos || data.balance_infos.length === 0) {
    return {
      platform,
      balance: 0,
      currency: 'CNY',
      display: 'NoInfo',
      raw_data: data,
    };
  }

  const primary = data.balance_infos[0];
  const balance = parseFloat(primary.total_balance);
  const currency = primary.currency || 'CNY';

  return {
    platform,
    balance,
    currency,
    display: currency === 'CNY' ? `¥${balance.toFixed(2)}` : `$${balance.toFixed(2)}`,
    color: getBalanceColor(balance, currency),
    raw_data: data,
  };
}

function getBalanceColor(balance: number, currency: string): 'green' | 'yellow' | 'red' {
  if (balance < 0) return 'red';
  if (currency === 'CNY' || currency === '¥') {
    if (balance <= 1) return 'red';
    if (balance <= 10) return 'yellow';
    return 'green';
  }
  if (balance <= 1) return 'red';
  if (balance <= 10) return 'yellow';
  return 'green';
}

export const fetcher: BalanceFetcher = {
  platform,
  fetch: fetchBalance,
};
