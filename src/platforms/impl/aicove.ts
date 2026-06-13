/**
 * AI Cove 平台实现
 * https://api.ai-cove.com/api/billing/self
 * 余额/订阅查询:钱包 + active 订阅
 */
import type { BalanceFetcher, BalanceResult } from '../base.js';

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
  return `$${amount.toFixed(6).replace(/\.?0+$/, '')}`;
}

function formatResetTime(timestampSec: number): string {
  if (!timestampSec || timestampSec <= 0) return '(NoReset)';
  const date = new Date(timestampSec * 1000);
  const now = new Date();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  if (date.getFullYear() === now.getFullYear() &&
      date.getMonth() === now.getMonth() &&
      day === now.getDate()) {
    return `(${hours}:${minutes})`;
  }
  return `(${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')} ${hours}:${minutes})`;
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
    if (response.status === 403) {
      throw new Error('token_disabled');
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
    const resetTime = formatResetTime(activeSub.next_reset_time || activeSub.end_time);
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
