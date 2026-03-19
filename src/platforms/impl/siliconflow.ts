/**
 * SiliconFlow 平台实现
 * 参考 SiliconFlow API
 */
import type { BalanceFetcher, BalanceResult } from '../base.js';

export const platform = 'siliconflow';

const API_BASE = 'https://api.siliconflow.cn';

interface SiliconFlowResponse {
  code: number;
  data: {
    id: string;
    balance: string;
    totalBalance: string;
    chargeBalance: string;
  };
}

async function fetchBalance(apiKey: string | undefined, _baseUrl: string | undefined): Promise<BalanceResult> {
  if (!apiKey) {
    throw new Error('No API key');
  }

  const url = `${API_BASE}/v1/user/info`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  const data = await response.json() as SiliconFlowResponse;

  if (data.code !== 20000) {
    return {
      platform,
      balance: 0,
      currency: 'CNY',
      display: `API${data.code}`,
      raw_data: data,
    };
  }

  // totalBalance 是实际总余额（包含充值和消耗），单位是元
  const balance = parseFloat(data.data.totalBalance);

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
