/**
 * GAC Code 平台实现
 */
import type { BalanceFetcher, BalanceResult } from '../base.js';

export const platform = 'gaccode';

const DEFAULT_BASE_URL = 'https://gaccode.com';

async function fetchBalance(loginToken: string | undefined, baseUrl: string | undefined): Promise<BalanceResult> {
  if (!loginToken) {
    throw new Error('No login token');
  }

  const apiBase = baseUrl || DEFAULT_BASE_URL;
  const response = await fetch(`${apiBase}/api/credits/balance`, {
    headers: {
      'Authorization': loginToken.startsWith('Bearer ') ? loginToken : `Bearer ${loginToken}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  const data = await response.json() as {
    code: number;
    data?: {
      balance: number;
      limit: number;
    };
  };

  if (data.code !== 0 || !data.data) {
    return {
      platform,
      balance: 0,
      currency: 'CNY',
      display: `API${data.code || 'Error'}`,
      raw_data: data,
    };
  }

  const { balance, limit } = data.data;
  const display = limit > 0 ? `${balance}/${limit}` : `${balance}`;

  return {
    platform,
    balance,
    currency: 'CNY',
    display,
    color: getBalanceColor(balance, limit),
    raw_data: data,
  };
}

function getBalanceColor(balance: number, limit: number): 'green' | 'yellow' | 'red' {
  if (limit > 0) {
    const percentage = (balance / limit) * 100;
    if (percentage <= 10) return 'red';
    if (percentage <= 30) return 'yellow';
    return 'green';
  }
  if (balance <= 0) return 'red';
  if (balance <= 10) return 'yellow';
  return 'green';
}

export const fetcher: BalanceFetcher = {
  platform,
  fetch: fetchBalance,
};
