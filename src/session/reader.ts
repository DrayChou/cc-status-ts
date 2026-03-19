/**
 * Session 信息读取
 */
import type { SessionInfo } from '../types.js';

export async function readSessionInfo(): Promise<SessionInfo | null> {
  return new Promise((resolve) => {
    const chunks: string[] = [];

    process.stdin.on('data', (chunk: string) => {
      chunks.push(chunk);
    });

    process.stdin.on('end', () => {
      const input = chunks.join('');
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

    process.stdin.on('error', () => {
      resolve(null);
    });

    // 超时处理
    setTimeout(() => {
      resolve(null);
    }, 1000);
  });
}
