/**
 * cc-status-ts - Claude Code Multi-Platform Status Bar Plugin
 * 主入口文件
 */

import * as readline from 'node:readline';
import { loadPlatformsConfig } from './config/platforms.js';
import { loadStatusConfig } from './config/status.js';
import { CacheManager } from './cache/index.js';
import { PlatformManager } from './platforms/index.js';
import { GitStatus } from './git/index.js';
import { parseContext } from './hud/context.js';
import { getUsage } from './hud/usage.js';
import { parseTranscript } from './hud/transcript.js';
import { countConfigs } from './hud/environment.js';
import { getOutputSpeed } from './speed-tracker.js';
import { renderStatus } from './display/index.js';
import type { SessionInfo, RenderContext } from './types.js';
import type { TranscriptData } from './hud/types.js';

/**
 * 读取 stdin 中的 session 信息
 */
async function readStdin(): Promise<SessionInfo | null> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    let input = '';
    rl.on('line', (line) => {
      input += line;
    });

    rl.on('close', () => {
      if (!input.trim()) {
        resolve(null);
        return;
      }
      try {
        const data = JSON.parse(input);
        resolve(data);
      } catch {
        resolve(null);
      }
    });

    // 超时处理
    setTimeout(() => {
      rl.close();
      resolve(null);
    }, 1000);
  });
}

/**
 * 格式化时长 (ms -> "1h 23m" 或 "45m" 或 "1m 30s")
 */
function formatDuration(ms: number): string {
  if (ms < 0) return '0s';
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    const remainingMinutes = minutes % 60;
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
  }
  if (minutes > 0) {
    const remainingSeconds = seconds % 60;
    return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
  }
  return `${seconds}s`;
}

/**
 * 主函数
 */
async function main(): Promise<void> {
  try {
    // 1. 读取 session info (stdin)
    const session = await readStdin();

    // 2. 加载配置
    const platformsConfig = await loadPlatformsConfig();
    const statusConfig = await loadStatusConfig();

    // 3. 初始化缓存管理器
    const cacheManager = new CacheManager();

    // 4. 初始化平台管理器
    const platformManager = new PlatformManager(platformsConfig);

    // 5. 获取 Git 状态
    const gitStatus = await GitStatus.get(session?.workspace?.current_dir);

    // 6. 获取平台余额数据
    const platformData = await platformManager.fetchAll(cacheManager);

    // 7. 获取 Context 使用情况
    const context = parseContext(session);

    // 8. 获取 Anthropic 用量
    const usageData = await getUsage();

    // 9. 解析 Transcript
    const transcriptPath = session?.transcript_path;
    let transcriptData: TranscriptData = { tools: [], agents: [], todos: [] };
    if (transcriptPath) {
      try {
        transcriptData = await parseTranscript(transcriptPath);
      } catch {
        // Ignore transcript parse errors
      }
    }

    // 10. 统计配置数量
    const configCounts = await countConfigs(session?.workspace?.current_dir);

    // 11. 获取输出速度
    const outputSpeed = session ? getOutputSpeed(session) : null;

    // 12. 计算会话时长
    const sessionDuration = transcriptData.sessionStart
      ? formatDuration(Date.now() - transcriptData.sessionStart.getTime())
      : undefined;

    // 13. 构建渲染上下文
    const ctx: RenderContext = {
      session,
      platforms: platformData,
      git: gitStatus,
      config: statusConfig,
      timestamp: Date.now(),
      // HUD 扩展数据
      context,
      usage: usageData,
      transcript: transcriptData,
      // 配置统计
      ...configCounts,
      sessionDuration,
      // 速度
      speed: outputSpeed,
    };

    // 14. 渲染输出
    const lines = await renderStatus(ctx, statusConfig);

    // 15. 输出到 stdout
    for (const line of lines) {
      console.log(line);
    }
  } catch (error) {
    console.error('[cc-status-ts] Error:', error instanceof Error ? error.message : 'Unknown error');
    // 输出错误状态
    console.log('cc-status-ts error');
  }
}

main();
