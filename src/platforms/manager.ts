/**
 * 平台管理器
 */
import type { PlatformsConfig, PlatformBalance } from '../types.js';
import type { BalanceFetcher, BalanceResult } from './base.js';
import { getEnabledPlatforms } from '../config/index.js';
import { CacheManager } from '../cache/index.js';
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


// 平台类型别名映射 (platform_type -> base fetcher name)
const PLATFORM_ALIASES: Record<string, string> = {
  'glm-xianyu2': 'glm',
  'glm-xianyu1': 'glm',
  'kimi-for-coding': 'kfc',
  'oh-kfc': 'kfc',
};

// 关键词别名:platformType 包含任一 keyword (大小写不敏感) 即 alias 到 target
const KEYWORD_ALIASES: ReadonlyArray<{ keyword: string; target: string }> = [
  { keyword: 'aicove', target: 'aicove' },
  { keyword: 'ai-cove', target: 'aicove' },
];

/**
 * 获取平台的基础类型
 * 优先级: 精确别名 > 关键词别名 > 原值
 */
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

/**
 * 根据平台类型选择正确的认证 token
 * 不同平台使用不同类型的 token
 */
function getAuthToken(platformType: string, config: PlatformsConfig['platforms'][string]): string | undefined {
  switch (platformType) {
    case 'kfc':
      // KFC 需要 login_token (JWT)，不能用 auth_token (API key)
      return config.login_token || config.auth_token;
    case 'minimaxi':
      // Minimaxi 使用 auth_token
      return config.auth_token || config.api_key;
    case 'glm':
      // GLM 使用 auth_token (API key)
      return config.auth_token || config.api_key;
    case 'xai.ainaibahub':
      // xai.ainaibahub 使用 auth_token
      return config.auth_token || config.api_key;
    case 'deepseek':
    case 'kimi':
    case 'siliconflow':
    case 'gaccode':
    default:
      // 默认优先级: api_key > auth_token > login_token
      return config.api_key || config.auth_token || config.login_token;
  }
}

export class PlatformManager {
  private platformsConfig: PlatformsConfig;
  private fetcherMap: Map<string, BalanceFetcher>;

  constructor(config: PlatformsConfig) {
    this.platformsConfig = config;
    this.fetcherMap = new Map(Object.entries(FETCHERS));
  }

  /**
   * 获取所有启用的平台余额
   * 同 baseType 的 enabled 平台共享一次 fetch（避免共享 token 的同族平台重复调用）
   */
  async fetchAll(cacheManager: CacheManager): Promise<Record<string, PlatformBalance>> {
    const enabledPlatforms = getEnabledPlatforms(this.platformsConfig);
    const results: Record<string, PlatformBalance> = {};

    // 按 baseType 分组
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

      let result: BalanceResult;
      try {
        const cached = await cacheManager.getPlatformBalance<BalanceResult>(cacheKey);
        if (cached) {
          result = cached;
        } else {
          const apiKey = getAuthToken(baseType, firstConfig);
          result = await fetcher.fetch(apiKey, firstConfig.api_base_url);
          await cacheManager.setPlatformBalance(cacheKey, result);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        for (const { id } of items) {
          results[id] = {
            platform: id,
            balance: 0,
            currency: 'CNY',
            display: 'Error',
            error: errorMessage,
          };
        }
        return;
      }

      // 以 baseType 作 results key（同 baseType 多配置合并为 1 条）
      results[baseType] = this.resultToBalance(result);
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
