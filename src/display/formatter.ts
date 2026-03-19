/**
 * 格式化器
 */
import type { RenderContext, PlatformBalance, GitInfo } from '../types.js';
import { colorize, coloredBar } from './colors.js';
import { TOKEN_K_THRESHOLD, TOKEN_M_THRESHOLD } from '../constants.js';

const gitSymbols = {
  branch: '⎇',
  ahead: '↑',
  behind: '↓',
  dirty: '●',
  clean: '✓',
};

export function formatBalance(_platform: string, balance: PlatformBalance, name: string): string {
  const displayText = balance.display;

  const colored = balance.color
    ? colorize(displayText, getColorName(balance.color))
    : displayText;

  return `${name}:${colored}`;
}

function getColorName(color: 'green' | 'yellow' | 'red'): string {
  switch (color) {
    case 'green': return 'green';
    case 'yellow': return 'yellow';
    case 'red': return 'brightRed';
    default: return 'reset';
  }
}

export function formatGit(git: GitInfo | null): string {
  if (!git) return '';

  const parts = [gitSymbols.branch, git.branch];

  if (git.is_dirty) {
    parts.push(colorize(gitSymbols.dirty, 'brightRed'));
  }

  if (git.ahead > 0) {
    parts.push(`${gitSymbols.ahead}${git.ahead}`);
  }

  if (git.behind > 0) {
    parts.push(`${gitSymbols.behind}${git.behind}`);
  }

  return parts.join('');
}

export function formatModel(session: RenderContext['session']): string {
  if (!session?.model?.display_name) return '';
  return colorize(`[${session.model.display_name}]`, 'cyan');
}

export function formatContextBar(ctx: RenderContext): string {
  const cw = ctx.session?.context_window;
  if (!cw) return '';

  const usedPercent = cw.used_percentage ?? null;

  if (usedPercent === null) {
    return '';
  }

  // 使用 claude-hud 的 coloredBar (10 宽度)
  const bar = coloredBar(usedPercent, 10);

  return `Context ${bar} ${usedPercent.toFixed(0)}%`;
}

/**
 * 格式化 token 数量 (1000→1k, 1000000→1.0M)
 */
export function formatTokens(n: number): string {
  if (Number.isNaN(n) || !Number.isFinite(n)) {
    return '0';
  }
  if (n >= TOKEN_M_THRESHOLD) {
    return `${(n / TOKEN_M_THRESHOLD).toFixed(1)}M`;
  }
  if (n >= TOKEN_K_THRESHOLD) {
    return `${Math.round(n / TOKEN_K_THRESHOLD)}k`;
  }
  return n.toString();
}

/**
 * 格式化重置时间
 */
export function formatResetTime(resetAt: Date | null | undefined): string {
  if (!resetAt) return '';

  const now = new Date();
  const diffMs = resetAt.getTime() - now.getTime();

  if (diffMs <= 0) {
    return 'now';
  }

  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

  if (diffHours >= 24) {
    const days = Math.floor(diffHours / 24);
    return `${days}d`;
  }
  if (diffHours > 0) {
    return `${diffHours}h ${diffMinutes}m`;
  }
  return `${diffMinutes}m`;
}

/**
 * 格式化经过时间
 */
export function formatElapsed(startTime: Date, endTime?: Date | null): string {
  const end = endTime ?? new Date();
  const diffMs = end.getTime() - startTime.getTime();

  if (diffMs < 0) {
    return '0s';
  }

  const seconds = Math.floor(diffMs / 1000);
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
