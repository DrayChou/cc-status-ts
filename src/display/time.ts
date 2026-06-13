/**
 * 时间格式化辅助函数
 * 用于状态栏显示重置/结束时间
 */

/**
 * Format a timestamp as a short reset-time string.
 * - Today: `(HH:MM)`
 * - Other days: `(MM-DD HH:MM)`
 * - Invalid/zero: `(NoReset)`
 *
 * @param timestamp Unix timestamp
 * @param unit timestamp unit, 'ms' (default) or 'sec'
 */
export function formatResetTime(timestamp: number, unit: 'ms' | 'sec' = 'ms'): string {
  if (!timestamp || timestamp <= 0) {
    return '(NoReset)';
  }

  try {
    const ms = unit === 'sec' ? timestamp * 1000 : timestamp;
    const date = new Date(ms);
    const now = new Date();

    const month = date.getMonth() + 1;
    const day = date.getDate();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');

    if (date.getFullYear() === now.getFullYear() &&
        date.getMonth() === now.getMonth() &&
        day === now.getDate()) {
      return `(${hours}:${minutes})`;
    }
    return `(${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')} ${hours}:${minutes})`;
  } catch {
    return '(Err)';
  }
}
