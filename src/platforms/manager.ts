/**
 * 平台管理器
 */
import type { PlatformsConfig, PlatformBalance } from '../types.js';
import type { BalanceFetcher, BalanceResult } from './base.js';
import { getEnabledPlatforms } from '../config/index.js';
import { CacheManager, MIN_REFRESH_MS } from '../cache/index.js';
import { fetcher as deepseekFetcher } from './impl/deepseek.js';
import { fetcher as kimiFetcher } from './impl/kimi.js';
import { fetcher as glmFetcher } from './impl/glm.js';
import { fetcher as siliconflowFetcher } from './impl/siliconflow.js';
import { fetcher as kfcFetcher } from './impl/kfc.js';
import { fetcher as minimaxiFetcher } from './impl/minimaxi.js';
import { fetcher as gaccodeFetcher } from './impl/gaccode.js';
import { fetcher as xaiAinaibahubFetcher } from './impl/xai-ainaibahub.js';
import { fetcher as aicoveFetcher } from './impl/aicove.js';

const FETCHERS: Record<string, BalanceFetcher> = {
  deepseek: deepseekFetcher,
  kimi: kimiFetcher,
  glm: glmFetcher,
  siliconflow: siliconflowFetcher,
  kfc: kfcFetcher,
  minimaxi: minimaxiFetcher,
  gaccode: gaccodeFetcher,
  'xai.ainaibahub': xaiAinaibahubFetcher,
  aicove: aicoveFetcher,
};

const PLATFORM_ALIASES: Record<string, string> = {
  'glm-xianyu2': 'glm',
  'glm-xianyu1': 'glm',
  'kimi-for-coding': 'kfc',
  'oh-kfc': 'kfc',
};

const KEYWORD_ALIASES: ReadonlyArray<{ keyword: string; target: string }> = [
  { keyword: 'aicove', target: 'aicove' },
  { keyword: 'ai-cove', target: 'aicove' },
];

function getBasePlatformType(platformType: string): string {
  if (PLATFORM_ALIASES[platformType]) {
    return PLATFORM_ALIASES[platformType];
  }
  const lower = platformType.toLowerCase();
  for (const { keyword, target } of KEYWORD_ALIASES) {
    if (lower.includes(keyword.toLowerCase())) {
      return target;
    }
  }
  return platformType;
}

function getAuthToken(platformType: string, config: PlatformsConfig['platforms'][string]): string | undefined {
  switch (platformType) {
    case 'kfc':
      return config.login_token || config.auth_token;
    case 'minimaxi':
      return config.auth_token || config.api_key;
    case 'glm':
      return config.auth_token || config.api_key;
    case 'xai.ainaibahub':
      return config.auth_token || config.api_key;
    case 'deepseek':
    case 'kimi':
    case 'siliconflow':
    case 'gaccode':
    default:
      return config.api_key || config.auth_token || config.login_token;
  }
}

type ErrorCategory = 'rate_limited' | 'transient' | 'fatal';

function classifyError(msg: string): ErrorCategory {
  if (msg === 'rate_limited' || msg.includes('429')) return 'rate_limited';
  if (msg === 'invalid_token' || msg === 'token_disabled' || msg === 'No API key') return 'fatal';
  return 'transient';
}

export class PlatformManager {
  private platformsConfig: PlatformsConfig;
  private fetcherMap: Map<string, BalanceFetcher>;

  constructor(config: PlatformsConfig) {
    this.platformsConfig = config;
    this.fetcherMap = new Map(Object.entries(FETCHERS));
  }

  /**
   * 获取所有启用的平台余额。
   * - 同 baseType 共享一次 fetch(避免共享 token 同族重复请求)
   * - 60s 内不重复请求(MIN_REFRESH_MS)
   * - 多进程通过 fetch lock 去重,避免 cold cache 时并发冲击
   * - 失败时若有过期缓存,按错误分类决定是否兜底
   */
  async fetchAll(cacheManager: CacheManager): Promise<Record<string, PlatformBalance>> {
    const enabledPlatforms = getEnabledPlatforms(this.platformsConfig);
    const results: Record<string, PlatformBalance> = {};

    const groups = new Map<string, Array<{ id: string; config: PlatformsConfig['platforms'][string] }>>();
    for (const { id, config } of enabledPlatforms) {
      const platformType = config.platform_type || id;
      const baseType = getBasePlatformType(platformType);
      if (!this.fetcherMap.has(baseType)) continue;
      if (!groups.has(baseType)) groups.set(baseType, []);
      groups.get(baseType)!.push({ id, config });
    }

    const tasks = Array.from(groups.entries()).map(async ([baseType, items]) => {
      const fetcher = this.fetcherMap.get(baseType)!;
      const firstConfig = items[0].config;
      const cacheKey = `base:${baseType}`;
      const ttlMs = 5 * 60 * 1000;

      const sr = await cacheManager.getPlatformBalanceWithStale<BalanceResult>(cacheKey, ttlMs);
      let result: BalanceResult | null = null;
      let errorMessage: string | null = null;
      let staleAge = 0;

      // 1) 缓存 < MIN_REFRESH_MS:直接用,不发请求
      if (sr.fresh && sr.ageMs < MIN_REFRESH_MS) {
        result = sr.fresh;
      } else {
        // 2) 尝试 fetch(锁住避免并发)
        const gotLock = cacheManager.acquireFetchLock(cacheKey);
        if (gotLock) {
          try {
            const apiKey = getAuthToken(baseType, firstConfig);
            const fetched = await fetcher.fetch(apiKey, firstConfig.api_base_url);
            await cacheManager.setPlatformBalanceAtomic(cacheKey, fetched);
            result = fetched;
          } catch (e) {
            errorMessage = e instanceof Error ? e.message : 'Unknown error';
          } finally {
            cacheManager.releaseFetchLock(cacheKey);
          }
        } else {
          // 另一进程在 fetch:短等后重读,避免重复请求
          await new Promise(r => setTimeout(r, 100));
          const sr2 = await cacheManager.getPlatformBalanceWithStale<BalanceResult>(cacheKey, ttlMs);
          if (sr2.fresh) {
            result = sr2.fresh;
          } else if (sr.stale) {
            result = sr.stale;
            staleAge = sr.ageMs;
          } else {
            errorMessage = 'fetch_in_flight';
          }
        }
      }

      // 3) fetch 失败 + 有过期缓存 + 非 fatal → 用 stale 兜底
      if (errorMessage && !result) {
        const category = classifyError(errorMessage);
        if (category !== 'fatal' && sr.stale) {
          result = sr.stale;
          staleAge = sr.ageMs;
          errorMessage = null;
        }
      }

      if (result) {
        const balance = this.resultToBalance(result);
        if (staleAge > 0) {
          balance.stale = true;
          balance.staleAgeMs = staleAge;
        }
        balance.name = firstConfig.name || items[0].id;
        results[baseType] = balance;
      } else {
        results[baseType] = {
          platform: baseType,
          name: firstConfig.name || items[0].id,
          balance: 0,
          currency: 'CNY',
          display: 'Error',
          error: errorMessage ?? 'Unknown error',
          color: 'red',
        };
      }
    });

    await Promise.allSettled(tasks);

    return results;
  }

  private resultToBalance(result: BalanceResult): PlatformBalance {
    return {
      platform: result.platform,
      balance: result.balance,
      currency: result.currency,
      unit: result.unit,
      display: result.display,
      color: result.color,
    };
  }
}
