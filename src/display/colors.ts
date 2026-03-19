/**
 * 颜色处理 - 整合自 claude-hud
 */
import type { HudColorName } from '../types.js';

// ANSI 颜色代码
const RESET = '\x1b[0m';
const DIM = '\x1b[2m';
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const MAGENTA = '\x1b[35m';
const CYAN = '\x1b[36m';
const BRIGHT_BLUE = '\x1b[94m';
const BRIGHT_MAGENTA = '\x1b[95m';

const ANSI_BY_NAME: Record<HudColorName, string> = {
  red: RED,
  green: GREEN,
  yellow: YELLOW,
  magenta: MAGENTA,
  cyan: CYAN,
  brightBlue: BRIGHT_BLUE,
  brightMagenta: BRIGHT_MAGENTA,
};

function resolveAnsi(name: HudColorName | undefined, fallback: string): string {
  if (!name) {
    return fallback;
  }
  return ANSI_BY_NAME[name] ?? fallback;
}

// 导出基础颜色（保持向后兼容）
export const colors = {
  reset: RESET,
  red: RED,
  green: GREEN,
  yellow: YELLOW,
  blue: '\x1b[34m',
  magenta: MAGENTA,
  cyan: CYAN,
  brightRed: '\x1b[91m',
  brightGreen: '\x1b[92m',
  brightYellow: '\x1b[93m',
  brightBlue: BRIGHT_BLUE,
  brightMagenta: BRIGHT_MAGENTA,
  brightCyan: '\x1b[96m',
};

export function colorizeText(text: string, color: string): string {
  const colorCode = colors[color as keyof typeof colors];
  if (!colorCode) return text;
  return `${colorCode}${text}${RESET}`;
}

/**
 * 通用着色函数 - 导出供外部使用
 */
export function colorize(text: string, color: string): string {
  const colorCode = colors[color as keyof typeof colors];
  if (!colorCode) return text;
  return `${colorCode}${text}${RESET}`;
}

export function dim(text: string): string {
  return colorize(text, DIM);
}

// ============================================
// 来自 claude-hud 的进度条和颜色函数
// ============================================

export function green(text: string): string {
  return colorize(text, GREEN);
}

export function yellow(text: string): string {
  return colorize(text, YELLOW);
}

export function red(text: string): string {
  return colorize(text, RED);
}

export function cyan(text: string): string {
  return colorize(text, CYAN);
}

export function magenta(text: string): string {
  return colorize(text, MAGENTA);
}

export interface ColorOverrides {
  context?: HudColorName;
  usage?: HudColorName;
  warning?: HudColorName;
  critical?: HudColorName;
}

export function warning(text: string, colors?: Partial<ColorOverrides>): string {
  return colorize(text, resolveAnsi(colors?.warning, YELLOW));
}

export function critical(text: string, colors?: Partial<ColorOverrides>): string {
  return colorize(text, resolveAnsi(colors?.critical, RED));
}

export function getContextColor(percent: number, colors?: Partial<ColorOverrides>): string {
  if (percent >= 85) return resolveAnsi(colors?.critical, RED);
  if (percent >= 70) return resolveAnsi(colors?.warning, YELLOW);
  return resolveAnsi(colors?.context, GREEN);
}

export function getQuotaColor(percent: number, colors?: Partial<ColorOverrides>): string {
  if (percent >= 90) return resolveAnsi(colors?.critical, RED);
  if (percent >= 75) return resolveAnsi(colors?.usage, BRIGHT_MAGENTA);
  return resolveAnsi(colors?.usage, BRIGHT_BLUE);
}

/**
 * 用量进度条 (quotaBar)
 */
export function quotaBar(percent: number, width: number = 10, colors?: Partial<ColorOverrides>): string {
  const safeWidth = Number.isFinite(width) ? Math.max(0, Math.round(width)) : 0;
  const safePercent = Number.isFinite(percent) ? Math.min(100, Math.max(0, percent)) : 0;
  const filled = Math.round((safePercent / 100) * safeWidth);
  const empty = safeWidth - filled;
  const color = getQuotaColor(safePercent, colors);
  return `${color}${'█'.repeat(filled)}${DIM}${'░'.repeat(empty)}${RESET}`;
}

/**
 * Context 进度条 (coloredBar)
 */
export function coloredBar(percent: number, width: number = 10, colors?: Partial<ColorOverrides>): string {
  const safeWidth = Number.isFinite(width) ? Math.max(0, Math.round(width)) : 0;
  const safePercent = Number.isFinite(percent) ? Math.min(100, Math.max(0, percent)) : 0;
  const filled = Math.round((safePercent / 100) * safeWidth);
  const empty = safeWidth - filled;
  const color = getContextColor(safePercent, colors);
  return `${color}${'█'.repeat(filled)}${DIM}${'░'.repeat(empty)}${RESET}`;
}

// ============================================
// 视觉宽度计算 (来自 claude-hud)
// ============================================

/**
 * 检查是否为宽字符 (CJK, emoji 等)
 */
function isWideCodePoint(codePoint: number): boolean {
  // CJK Unified Ideographs, Hiragana, Katakana, Hangul
  if (codePoint >= 0x1100 && codePoint <= 0x115F) return true;
  if (codePoint >= 0x2329) return true;
  if (codePoint >= 0x2E80 && codePoint <= 0x303E) return true;
  if (codePoint >= 0x3040 && codePoint <= 0xA4CF) return true;
  if (codePoint >= 0xAC00 && codePoint <= 0xD7A3) return true;
  if (codePoint >= 0xF900 && codePoint <= 0xFAFF) return true;
  if (codePoint >= 0xFE10 && codePoint <= 0xFE1F) return true;
  if (codePoint >= 0xFE30 && codePoint <= 0xFE6F) return true;
  if (codePoint >= 0xFF00 && codePoint <= 0xFF60) return true;
  if (codePoint >= 0xFFE0 && codePoint <= 0xFFE6) return true;
  if (codePoint >= 0x20000 && codePoint <= 0x2FFFD) return true;
  if (codePoint >= 0x30000 && codePoint <= 0x3FFFD) return true;
  return false;
}

/**
 * 获取单个字符的显示宽度
 */
function graphemeWidth(grapheme: string): number {
  if (grapheme.length === 0) return 0;
  if (grapheme.length === 1) {
    const codePoint = grapheme.charCodeAt(0);
    // ASCII 控制字符
    if (codePoint < 32) return 0;
    return isWideCodePoint(codePoint) ? 2 : 1;
  }
  // Emoji 等多代码点字符
  let width = 0;
  for (const char of grapheme) {
    const cp = char.codePointAt(0);
    if (cp !== undefined) {
      width += isWideCodePoint(cp) ? 2 : 1;
    }
  }
  return width;
}

/**
 * 计算字符串的视觉宽度（排除 ANSI 转义码）
 */
export function visualLength(str: string): number {
  // 移除 ANSI 转义序列
  const stripped = str.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '');
  let length = 0;
  // 使用 Unicode 字素迭代器
  const iterator = stripped[Symbol.iterator]();
  let currentGrapheme = '';
  let prevCodeUnit = 0;
  for (const char of iterator) {
    const codeUnit = char.codePointAt(0) ?? 0;
    // 检测图形字符边界
    if (prevCodeUnit >= 0xAC00 && prevCodeUnit <= 0xD7A3) {
      // Hangul 组合
      if (codeUnit >= 0xAC00 && codeUnit <= 0xD7A3) {
        currentGrapheme += char;
        prevCodeUnit = codeUnit;
        continue;
      }
    }
    if (prevCodeUnit >= 0x3100 && prevCodeUnit <= 0x312F) {
      // 中古汉语拼音声调
      if (codeUnit >= 0x3100 && codeUnit <= 0x312F) {
        currentGrapheme += char;
        prevCodeUnit = codeUnit;
        continue;
      }
    }
    if (currentGrapheme) {
      length += graphemeWidth(currentGrapheme);
      currentGrapheme = '';
    }
    currentGrapheme = char;
    prevCodeUnit = codeUnit;
  }
  if (currentGrapheme) {
    length += graphemeWidth(currentGrapheme);
  }
  return length;
}
