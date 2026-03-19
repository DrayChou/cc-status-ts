/**
 * Context Window 解析 - 解析 session 中的 context 使用情况
 */
import type { SessionInfo } from '../types.js';
import type { SessionContext } from './types.js';

export function parseContext(session: SessionInfo | null): SessionContext | null {
  if (!session?.context_window) {
    return null;
  }

  const cw = session.context_window;

  // Claude Code v2.1.6+ 提供直接百分比
  if (cw.used_percentage !== null && cw.used_percentage !== undefined) {
    return {
      usedTokens: 0,
      maxTokens: 0,
      usedPercentage: cw.used_percentage,
    };
  }

  // 旧版本需要手动计算
  if (cw.current_usage && cw.context_window_size) {
    const inputTokens = cw.current_usage.input_tokens ?? 0;
    const outputTokens = cw.current_usage.output_tokens ?? 0;
    const cacheRead = cw.current_usage.cache_read_input_tokens ?? 0;
    const cacheCreate = cw.current_usage.cache_creation_input_tokens ?? 0;

    // 计算总使用量（需要估算权重）
    const totalUsed = inputTokens + outputTokens + Math.floor(cacheRead * 0.1) + Math.floor(cacheCreate * 0.1);
    const maxTokens = cw.context_window_size;
    const percentage = maxTokens > 0 ? (totalUsed / maxTokens) * 100 : 0;

    return {
      usedTokens: totalUsed,
      maxTokens,
      usedPercentage: Math.min(100, percentage),
    };
  }

  return null;
}

/**
 * 生成 Context Bar 字符串
 */
export function formatContextBar(context: SessionContext | null): string {
  if (!context) {
    return '';
  }

  const { usedPercentage } = context;
  if (usedPercentage === null) {
    return '';
  }

  const filled = Math.round(usedPercentage / 5); // 20个方块
  const empty = 20 - filled;
  const bar = '█'.repeat(Math.max(0, filled)) + '░'.repeat(Math.max(0, empty));

  let barColor = 'green';
  if (usedPercentage >= 90) barColor = 'brightRed';
  else if (usedPercentage >= 70) barColor = 'yellow';

  return `Context ${barColorize(bar, barColor)} ${usedPercentage.toFixed(0)}%`;
}

function barColorize(text: string, color: string): string {
  const colors: Record<string, string> = {
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    brightRed: '\x1b[91m',
  };
  const colorCode = colors[color] || '';
  return `${colorCode}${text}\x1b[0m`;
}
