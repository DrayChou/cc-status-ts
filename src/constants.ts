/**
 * 常量定义
 */

// Context 压缩缓冲百分比 (用于 autocompact 模式)
export const AUTOCOMPACT_BUFFER_PERCENT = 0.05;

// 进度条默认宽度
export const DEFAULT_CONTEXT_BAR_WIDTH = 10;
export const DEFAULT_QUOTA_BAR_WIDTH = 10;

// 速度追踪窗口 (ms)
export const SPEED_WINDOW_MS = 2000;

// 用量缓存 TTL (ms)
export const USAGE_CACHE_TTL_MS = 60_000;
export const USAGE_FAILURE_CACHE_TTL_MS = 300_000;

// Token 格式化阈值
export const TOKEN_K_THRESHOLD = 1_000;
export const TOKEN_M_THRESHOLD = 1_000_000;
