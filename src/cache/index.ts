/**
 * 缓存管理器
 * 文件级缓存 + 跨进程 fetch 去重锁
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

/** 最小刷新间隔: 缓存 < 此时间不应触发新请求 */
export const MIN_REFRESH_MS = 60_000;
/** provider 查询锁 TTL: 覆盖慢接口/弱网，避免请求尚未结束锁就过期 */
export const FETCH_LOCK_TTL_MS = 30_000;

interface CacheEntry<T> {
  data: T;
  cached_at: number;
  ttl: number;
}

export interface StaleResult<T> {
  /** age <= ttlMs 时非 null */
  fresh: T | null;
  /** 文件存在且可解析时非 null(任意年龄) */
  stale: T | null;
  /** 缓存写入至今的毫秒数,缺失/损坏时为 +Infinity */
  ageMs: number;
}

export class CacheManager {
  private cacheDir: string;
  private legacyCacheDir: string;

  constructor(cacheDir?: string) {
    this.legacyCacheDir = path.join(os.homedir(), '.claude', 'cache');
    this.cacheDir = cacheDir || path.join(this.legacyCacheDir, 'provider-balances');
  }

  /**
   * 单次读盘,返回 fresh / stale / age。
   * - fresh: 缓存年龄 <= ttlMs,可直接使用
   * - stale: 缓存存在且可解析,可作为 fetch 失败时的兜底
   *
   * 兼容旧路径 ~/.claude/cache/cache_{platform}_balance.json,
   * 新写入统一落到 ~/.claude/cache/provider-balances/providers/*.json。
   */
  async getPlatformBalanceWithStale<T>(platform: string, ttlMs: number): Promise<StaleResult<T>> {
    const files = this.getReadableCacheFiles(platform);
    for (const file of files) {
      if (!fs.existsSync(file)) continue;
      try {
        const content = fs.readFileSync(file, 'utf-8');
        const entry = JSON.parse(content) as CacheEntry<T>;
        const ageMs = Date.now() - entry.cached_at;
        const fresh = ageMs <= ttlMs ? entry.data : null;
        return { fresh, stale: entry.data, ageMs };
      } catch {
        continue;
      }
    }
    return { fresh: null, stale: null, ageMs: Number.POSITIVE_INFINITY };
  }

  /**
   * 原子写入:写 .tmp 再 renameSync,POSIX/macOS APFS 下原子。
   * 失败静默(statusline 不能因为写缓存崩)。
   */
  async setPlatformBalanceAtomic<T>(platform: string, data: T, ttl: number = 300): Promise<void> {
    const file = this.getCacheFile(platform);
    const dir = path.dirname(file);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const entry: CacheEntry<T> = { data, cached_at: Date.now(), ttl };
    const tmp = `${file}.tmp`;
    try {
      fs.writeFileSync(tmp, JSON.stringify(entry), 'utf-8');
      fs.renameSync(tmp, file);
    } catch {
      try { fs.unlinkSync(tmp); } catch { /* ignore */ }
    }
  }

  /**
   * 跨进程 fetch 去重锁。
   * 用 fs.openSync(path, 'wx') 做原子独占创建;已存在则检查 mtime,
   * 锁文件超过 ttlMs 视为过期,unlink 后重试。
   * 拿到锁会写入 {pid, ts, platform} 以便 releaseFetchLock 校验归属和排障。
   * 拿不到立即返回 false,不抛(statusline 必须能渲染)。
   */
  acquireFetchLock(platform: string, ttlMs: number = FETCH_LOCK_TTL_MS): boolean {
    const lockFile = this.getLockFile(platform);
    const dir = path.dirname(lockFile);
    // 确保 dir 存在(冷启动场景:全新用户/首次安装 cache dir 不存在)
    try {
      fs.mkdirSync(dir, { recursive: true });
    } catch { /* ignore — 若权限不足,openSync 会再报错 */ }

    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const fd = fs.openSync(lockFile, 'wx');
        try {
          fs.writeSync(fd, JSON.stringify({ pid: process.pid, ts: Date.now(), platform }));
        } finally {
          fs.closeSync(fd);
        }
        return true;
      } catch (e) {
        const code = (e as NodeJS.ErrnoException).code;
        if (code !== 'EEXIST') return false;
        // 锁已存在,检查是否过期
        try {
          const stat = fs.statSync(lockFile);
          if (Date.now() - stat.mtimeMs > ttlMs) {
            try { fs.unlinkSync(lockFile); } catch { /* race: another process took it */ }
            continue;
          }
        } catch {
          // 锁文件在 EEXIST 和 stat 之间消失(被另一进程接管/删除),重试 wx
          continue;
        }
        return false;
      }
    }
    return false;
  }

  /**
   * 释放锁:仅当锁内 pid 匹配当前进程才删除,防止延迟释放破坏他人锁。
   */
  releaseFetchLock(platform: string): void {
    const lockFile = this.getLockFile(platform);
    try {
      const content = fs.readFileSync(lockFile, 'utf-8');
      const lock = JSON.parse(content) as { pid?: number };
      if (lock.pid === process.pid) {
        fs.unlinkSync(lockFile);
      }
    } catch {
      /* lock missing or unreadable, nothing to release */
    }
  }

  private getReadableCacheFiles(platform: string): string[] {
    return [
      this.getCacheFile(platform),
      this.getLegacyCacheFile(platform),
    ];
  }

  private getCacheFile(platform: string): string {
    return path.join(this.cacheDir, 'providers', `${this.encodeKey(platform)}.json`);
  }

  private getLegacyCacheFile(platform: string): string {
    return path.join(this.legacyCacheDir, `cache_${platform}_balance.json`);
  }

  private getLockFile(platform: string): string {
    return path.join(this.cacheDir, 'locks', `${this.encodeKey(platform)}.lock`);
  }

  private encodeKey(key: string): string {
    return encodeURIComponent(key);
  }
}
