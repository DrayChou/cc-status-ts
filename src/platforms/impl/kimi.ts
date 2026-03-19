/**
 * Kimi 平台实现
 * 参考 Python cc-status 的实现
 */
import type { BalanceFetcher, BalanceResult } from '../base.js';

export const platform = 'kimi';

const API_BASE = 'https://api.moonshot.cn';

interface KimiResponse {
  code: number;
  data: {
    available_balance: number;
    voucher_balance: number;
    cash_balance: number;
  };
}

async function fetchBalance(authToken: string | undefined, _baseUrl: string | undefined): Promise<BalanceResult> {
  if (!authToken) {
    throw new Error('No auth token');
  }

  const url = `${API_BASE}/v1/users/me/balance`;

  const headers = {
    'Authorization': `Bearer ${authToken}`,
    'Content-Type': 'application/json',
  };

  const response = await fetch(url, {
    method: 'GET',
    headers,
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  const data = await response.json() as KimiResponse;

  if (data.code !== 0) {
    return {
      platform,
      balance: 0,
      currency: 'CNY',
      display: `API${data.code}`,
      raw_data: data,
    };
  }

  const balance = data.data.available_balance;

  return {
    platform,
    balance,
    currency: 'CNY',
    display: `¥${balance.toFixed(2)}`,
    color: getBalanceColor(balance),
    raw_data: data,
  };
}

function getBalanceColor(balance: number): 'green' | 'yellow' | 'red' {
  if (balance < 0) return 'red';
  if (balance <= 10) return 'red';
  if (balance <= 50) return 'yellow';
  return 'green';
}

export const fetcher: BalanceFetcher = {
  platform,
  fetch: fetchBalance,
};
