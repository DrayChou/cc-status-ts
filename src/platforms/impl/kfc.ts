/**
 * KFC (Kimi For Coding) 平台实现
 * 参考 Python cc-status 的实现
 */
import type { BalanceFetcher, BalanceResult } from '../base.js';

export const platform = 'kfc';

const API_BASE = 'https://www.kimi.com';

interface KFCResponse {
  code?: number;
  usages?: Array<{
    scope: string;
    detail: {
      limit: string;
      used: string;
      remaining: string;
      resetTime: string;
    };
    limits?: Array<{
      window?: {
        duration: number;
        timeUnit: string;
      };
      detail: {
        limit: string;
        used: string;
        remaining: string;
        resetTime: string;
      };
    }>;
  }>;
  message?: string;
}

async function fetchBalance(loginToken: string | undefined, _baseUrl: string | undefined): Promise<BalanceResult> {
  if (!loginToken) {
    throw new Error('No login token');
  }

  const url = `${API_BASE}/apiv2/kimi.gateway.billing.v1.BillingService/GetUsages`;

  const headers = {
    'accept': '*/*',
    'accept-language': 'zh-CN,zh-TW;q=0.9,zh-HK;q=0.8,zh;q=0.7,en-GB;q=0.6,en-US;q=0.5,en;q=0.4,ja;q=0.3,fr-FR;q=0.2,fr;q=0.1',
    'authorization': `Bearer ${loginToken}`,
    'cache-control': 'no-cache',
    'connect-protocol-version': '1',
    'content-type': 'application/json',
    'origin': 'https://www.kimi.com',
    'pragma': 'no-cache',
    'priority': 'u=1, i',
    'r-timezone': 'Asia/Shanghai',
    'referer': 'https://www.kimi.com/code/console?from=kfc_overview_topbar',
    'sec-ch-ua': '"Chromium";v="146", "Not-A.Brand";v="24", "Microsoft Edge";v="146"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"macOS"',
    'sec-fetch-dest': 'empty',
    'sec-fetch-mode': 'cors',
    'sec-fetch-site': 'same-origin',
    'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0',
    'x-language': 'zh-CN',
    'x-msh-device-id': '7568758400289468674',
    'x-msh-platform': 'web',
    'x-msh-session-id': '1731436144641341491',
    'x-msh-version': '1.0.0',
  };

  const body = {
    scope: ['FEATURE_CODING'],
  };

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  const data = await response.json() as KFCResponse;

  if (!data.usages || data.usages.length === 0) {
    return {
      platform,
      balance: 0,
      currency: 'CNY',
      display: 'NoUsage',
      raw_data: data,
    };
  }

  // Find FEATURE_CODING usage
  const usage = data.usages.find(u => u.scope === 'FEATURE_CODING');
  if (!usage) {
    return {
      platform,
      balance: 0,
      currency: 'CNY',
      display: 'NoUsage',
      raw_data: data,
    };
  }

  // Parse weekly data (detail.remaining is the actual remaining value)
  const weeklyDetail = usage.detail;
  const weeklyLimit = parseInt(weeklyDetail.limit || '0', 10);
  const weeklyRemaining = parseInt(weeklyDetail.remaining || '0', 10);
  const weeklyResetTime = weeklyDetail.resetTime;

  // Parse short-term data (5min window from limits array)
  const limits = usage.limits || [];
  let shortLimit = 0;
  let shortRemaining = 0;
  let shortResetTime = '';

  if (limits.length > 0) {
    const shortDetail = limits[0].detail;
    shortLimit = parseInt(shortDetail.limit || '0', 10);
    shortRemaining = parseInt(shortDetail.remaining || '0', 10);
    shortResetTime = shortDetail.resetTime;
  }

  // Format reset time
  const shortResetDisplay = formatResetTime(shortResetTime);
  const weeklyResetDisplay = formatResetTime(weeklyResetTime);

  // Color based on short remaining
  const color = shortRemaining <= 20 ? 'red' : shortRemaining <= 50 ? 'yellow' : 'green';

  // Format display: 5h:short_remaining/short_limit(reset_time)|wk:weekly_remaining/weekly_limit(reset_time)
  let display: string;
  if (shortLimit > 0 && weeklyLimit > 0) {
    display = `5h:${shortRemaining}/${shortLimit}${shortResetDisplay}|wk:${weeklyRemaining}/${weeklyLimit}${weeklyResetDisplay}`;
  } else if (weeklyLimit > 0) {
    display = `wk:${weeklyRemaining}/${weeklyLimit}${weeklyResetDisplay}`;
  } else {
    display = 'N/A';
  }

  return {
    platform,
    balance: shortRemaining,
    currency: 'CNY',
    unit: 'times',
    display,
    color,
    raw_data: data,
  };
}

function formatResetTime(resetTime: string): string {
  if (!resetTime) return '(NoReset)';

  try {
    // Parse ISO format: 2026-02-12T17:27:08.139540Z (UTC)
    if (!resetTime.includes('T')) {
      return `(${resetTime.slice(0, 16)})`;
    }

    // Parse the ISO time - JavaScript parses Z as UTC
    let resetFormatted = resetTime;
    if (resetTime.endsWith('Z')) {
      resetFormatted = resetTime.slice(0, -1) + '+00:00';
    }

    const utcDate = new Date(resetFormatted);
    if (isNaN(utcDate.getTime())) {
      return `(${resetTime.slice(0, 16)})`;
    }

    // Use toLocaleString with timeZone option to convert to local time
    const localDateStr = utcDate.toLocaleString('zh-CN', {
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });

    // Parse the formatted string (format: "2026/03/19 15:27")
    const parts = localDateStr.split(/[\/\s:]/);
    if (parts.length < 5) {
      return `(${resetTime.slice(0, 16)})`;
    }

    const localMonth = parseInt(parts[1], 10);
    const localDay = parseInt(parts[2], 10);
    const localHour = parseInt(parts[3], 10);
    const localMinute = parseInt(parts[4], 10);

    // Get today's date for comparison
    const now = new Date();
    const todayMonth = now.getMonth() + 1;
    const todayDay = now.getDate();

    let resetShort: string;
    if (localMonth === todayMonth && localDay === todayDay) {
      // Today - show only time HH:MM
      resetShort = `${String(localHour).padStart(2, '0')}:${String(localMinute).padStart(2, '0')}`;
    } else {
      // Other dates show MM-DD HH:MM
      resetShort = `${String(localMonth).padStart(2, '0')}-${String(localDay).padStart(2, '0')} ${String(localHour).padStart(2, '0')}:${String(localMinute).padStart(2, '0')}`;
    }

    return `(${resetShort})`;
  } catch {
    return `(${resetTime.slice(0, 16)})`;
  }
}

export const fetcher: BalanceFetcher = {
  platform,
  fetch: fetchBalance,
};
