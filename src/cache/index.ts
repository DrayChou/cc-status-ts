/**
 * 缓存管理器
 * 读取 Python 写入的缓存文件
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

interface CacheEntry<T> {
  data: T;
  cached_at: number;
  ttl: number;
}

export class CacheManager {
  private cacheDir: string;

  constructor(cacheDir?: string) {
    this.cacheDir = cacheDir || path.join(os.homedir(), '.claude', 'cache');
  }

  /**
   * 读取缓存
   */
  async get<T>(key: string, ttlMs?: number): Promise<T | null> {
    const file = this.getCacheFile(key);
    if (!fs.existsSync(file)) {
      return null;
    }

    try {
      const content = fs.readFileSync(file, 'utf-8');
      const entry = JSON.parse(content) as CacheEntry<T>;

      // 检查 TTL
      if (ttlMs !== undefined) {
        const age = Date.now() - entry.cached_at;
        if (age > ttlMs) {
          return null;
        }
      }

      return entry.data;
    } catch {
      return null;
    }
  }

  /**
   * 写入缓存
   */
  async set<T>(key: string, data: T, ttl: number = 300): Promise<void> {
    const file = this.getCacheFile(key);
    const dir = path.dirname(file);

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const entry: CacheEntry<T> = {
      data,
      cached_at: Date.now(),
      ttl,
    };

    fs.writeFileSync(file, JSON.stringify(entry), 'utf-8');
  }

  /**
   * 获取缓存文件路径
   */
  private getCacheFile(key: string): string {
    return path.join(this.cacheDir, `cache_${key}.json`);
  }

  /**
   * 获取平台余额缓存
   */
  async getPlatformBalance<T>(platform: string): Promise<T | null> {
    return this.get<T>(`${platform}_balance`, 5 * 60 * 1000); // 5分钟 TTL
  }

  /**
   * 写入平台余额缓存
   */
  async setPlatformBalance<T>(platform: string, data: T): Promise<void> {
    await this.set(`${platform}_balance`, data, 300); // 5分钟 TTL
  }
}
