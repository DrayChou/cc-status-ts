/**
 * 平台配置加载
 * 从 ~/.claude/config/platforms.json 读取
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import type { PlatformsConfig } from '../types.js';

const DEFAULT_CONFIG: PlatformsConfig = {
  platforms: {},
  default_platform: 'gaccode',
};

export async function loadPlatformsConfig(): Promise<PlatformsConfig> {
  const configPath = path.join(os.homedir(), '.claude', 'config', 'platforms.json');

  if (!fs.existsSync(configPath)) {
    return DEFAULT_CONFIG;
  }

  try {
    const content = fs.readFileSync(configPath, 'utf-8');
    const config = JSON.parse(content) as PlatformsConfig;
    return config;
  } catch (error) {
    console.error('[cc-status-ts] Failed to load platforms config:', error);
    return DEFAULT_CONFIG;
  }
}

export function getEnabledPlatforms(config: PlatformsConfig): Array<{ id: string; config: PlatformsConfig['platforms'][string] }> {
  const enabled: Array<{ id: string; config: PlatformsConfig['platforms'][string] }> = [];

  for (const [id, platformConfig] of Object.entries(config.platforms)) {
    if (platformConfig.enabled && hasValidAuth(platformConfig)) {
      enabled.push({ id, config: platformConfig });
    }
  }

  return enabled;
}

function hasValidAuth(config: PlatformsConfig['platforms'][string]): boolean {
  return !!(config.api_key || config.auth_token || config.login_token);
}
