/**
 * AI Cove 平台实现
 * https://api.ai-cove.com/api/billing/self
 * 余额/订阅查询:钱包 + active 订阅
 */
import type { BalanceFetcher, BalanceResult } from '../base.js';
import { formatResetTime } from '../../display/time.js';

export const platform = 'aicove';

const API_BASE = 'https://api.ai-cove.com';

interface Subscription {
  id: number;
  plan_id: number;
  status: string;
  source: string;
  start_time: number;
  end_time: number;
  next_reset_time: number;
  amount_total: number;
  amount_used: number;
  amount_remaining: number;
  unlimited: boolean;
}

interface Wallet {
  remaining_amount: number;
  used_amount: number;
}

interface AicoveData {
  currency: string;
  billing_preference: string;
  has_active_subscription: boolean;
  wallet: Wallet;
  subscriptions: Subscription[];
}

interface AicoveResponse {
  success: boolean;
  message: string;
  data?: AicoveData;
}

function formatUsd(amount: number): string {
  // 0 直接返回 $0,避免 toFixed(6).replace 把 '0.000000' 替空成 '$'
  if (amount === 0) return '$0';
  return `$${amount.toFixed(6).replace(/\.?0+$/, '')}`;
}

async function fetchBalance(apiKey: string | undefined, _baseUrl: string | undefined): Promise<BalanceResult> {
  if (!apiKey) {
    throw new Error('No API key');
  }

  const url = `${API_BASE}/api/billing/self`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('invalid_token');
    }
    if (response.status === 403) {
      throw new Error('token_disabled');
    }
    if (response.status === 429) {
      throw new Error('rate_limited');
    }
    throw new Error(`API error: ${response.status}`);
  }

  const data = await response.json() as AicoveResponse;

  if (!data.success || !data.data) {
    return {
      platform,
      balance: 0,
      currency: 'USD',
      display: data.message || 'APIError',
      raw_data: data,
    };
  }

  const { wallet, subscriptions, has_active_subscription } = data.data;
  const activeSub = subscriptions.find(s => s.status === 'active');
  const walletDisplay = formatUsd(wallet.remaining_amount);

  let display: string;
  let color: 'green' | 'yellow' | 'red' = 'green';
  const balance = wallet.remaining_amount;

  if (activeSub) {
    const resetTime = formatResetTime(activeSub.next_reset_time || activeSub.end_time, 'sec');
    if (activeSub.unlimited) {
      display = `sub:∞${resetTime}|wallet:${walletDisplay}`;
      color = 'green';
    } else {
      const subRemaining = formatUsd(activeSub.amount_remaining);
      const subTotal = formatUsd(activeSub.amount_total);
      const ratio = activeSub.amount_total > 0
        ? (activeSub.amount_remaining / activeSub.amount_total) * 100
        : 0;
      color = ratio <= 10 ? 'red' : ratio <= 30 ? 'yellow' : 'green';
      display = `sub:${subRemaining}/${subTotal}${resetTime}|wallet:${walletDisplay}`;
    }
  } else {
    display = `wallet:${walletDisplay}`;
    if (!has_active_subscription) {
      color = 'yellow';
    }
  }

  return {
    platform,
    balance,
    currency: 'USD',
    display,
    color,
    raw_data: data,
  };
}

export const fetcher: BalanceFetcher = {
  platform,
  fetch: fetchBalance,
};
