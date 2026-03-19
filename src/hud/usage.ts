/**
 * Anthropic Usage API - 获取 Pro/Max/Team 订阅用量
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import type { UsageData } from './types.js';

const CACHE_TTL_MS = 60_000; // 1分钟
const CACHE_PATH = path.join(os.homedir(), '.claude', 'plugins', 'cc-status-hud', '.usage-cache.json');

interface CacheEntry {
  data: UsageData;
  timestamp: number;
}

/**
 * 获取 Anthropic OAuth 使用量
 */
export async function getUsage(): Promise<UsageData | null> {
  // 检查缓存
  const cached = readCache();
  if (cached) {
    return cached;
  }

  // 获取凭据
  const credentials = getCredentials();
  if (!credentials) {
    return null;
  }

  // 获取用量数据
  const data = await fetchUsage(credentials.accessToken);
  if (data) {
    writeCache(data);
  }

  return data;
}

function readCache(): UsageData | null {
  try {
    if (!fs.existsSync(CACHE_PATH)) {
      return null;
    }

    const content = fs.readFileSync(CACHE_PATH, 'utf-8');
    const entry = JSON.parse(content) as CacheEntry;

    if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
      return null;
    }

    // 恢复 Date 对象
    if (entry.data.fiveHourResetAt) {
      entry.data.fiveHourResetAt = new Date(entry.data.fiveHourResetAt);
    }
    if (entry.data.sevenDayResetAt) {
      entry.data.sevenDayResetAt = new Date(entry.data.sevenDayResetAt);
    }

    return entry.data;
  } catch {
    return null;
  }
}

function writeCache(data: UsageData): void {
  try {
    const dir = path.dirname(CACHE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const entry: CacheEntry = {
      data,
      timestamp: Date.now(),
    };

    fs.writeFileSync(CACHE_PATH, JSON.stringify(entry), 'utf-8');
  } catch {
    // Ignore cache write failures
  }
}

function getCredentials(): { accessToken: string; subscriptionType: string } | null {
  try {
    // 尝试从 keychain 获取凭据 (macOS)
    if (process.platform === 'darwin') {
      return getCredentialsFromKeychainDarwin();
    }
    return null;
  } catch {
    return null;
  }
}

function getCredentialsFromKeychainDarwin(): { accessToken: string; subscriptionType: string } | null {
  try {
    // 使用 security 命令查询 keychain
    const { execSync } = require('node:child_process');

    const output = execSync(
      'security find-generic-password -s "Claude Code-credentials" -w 2>/dev/null',
      { encoding: 'utf-8' }
    ).trim();

    if (!output) {
      return null;
    }

    // 凭据是 base64 编码的 JSON
    const decoded = Buffer.from(output, 'base64').toString('utf-8');
    const creds = JSON.parse(decoded);

    if (creds.claudeAiOauth?.accessToken) {
      return {
        accessToken: creds.claudeAiOauth.accessToken,
        subscriptionType: creds.claudeAiOauth.subscriptionType || '',
      };
    }

    return null;
  } catch {
    return null;
  }
}

async function fetchUsage(accessToken: string): Promise<UsageData | null> {
  try {
    // 检查是否使用自定义 API
    const baseUrl = process.env.ANTHROPIC_BASE_URL?.trim() || process.env.ANTHROPIC_API_BASE_URL?.trim();
    if (baseUrl && new URL(baseUrl).origin !== 'https://api.anthropic.com') {
      return null; // 自定义 API，跳过用量显示
    }

    const response = await fetch('https://api.anthropic.com/usage', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'User-Agent': 'cc-status-ts/1.0',
      },
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json() as {
      five_hour?: { utilization: number; resets_at: string };
      seven_day?: { utilization: number; resets_at: string };
    };

    const planName = 'Pro'; // 默认

    return {
      planName,
      fiveHour: data.five_hour?.utilization ?? null,
      sevenDay: data.seven_day?.utilization ?? null,
      fiveHourResetAt: data.five_hour?.resets_at ? new Date(data.five_hour.resets_at) : null,
      sevenDayResetAt: data.seven_day?.resets_at ? new Date(data.seven_day.resets_at) : null,
    };
  } catch {
    return null;
  }
}

/**
 * 格式化用量显示
 */
export function formatUsage(usage: UsageData | null): string {
  if (!usage) {
    return '';
  }

  const parts: string[] = [];

  if (usage.planName) {
    parts.push(usage.planName);
  }

  if (usage.fiveHour !== null) {
    const bar = formatUsageBar(usage.fiveHour);
    parts.push(`5h ${bar} ${usage.fiveHour.toFixed(0)}%`);
  }

  if (usage.sevenDay !== null) {
    const bar = formatUsageBar(usage.sevenDay);
    parts.push(`7d ${bar} ${usage.sevenDay.toFixed(0)}%`);
  }

  return parts.join(' │ ');
}

function formatUsageBar(percentage: number): string {
  const filled = Math.round(percentage / 10);
  const empty = 10 - filled;
  return '█'.repeat(Math.max(0, filled)) + '░'.repeat(Math.max(0, empty));
}
