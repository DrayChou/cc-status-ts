/**
 * Git 状态获取
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { GitInfo } from '../types.js';

const execFileAsync = promisify(execFile);

export class GitStatus {
  /**
   * 获取 Git 状态
   */
  static async get(cwd?: string): Promise<GitInfo | null> {
    if (!cwd) {
      return null;
    }

    try {
      // 获取分支名
      const { stdout: branchOut } = await execFileAsync(
        'git',
        ['rev-parse', '--abbrev-ref', 'HEAD'],
        { cwd, timeout: 1000 }
      );
      const branch = branchOut.trim();
      if (!branch) return null;

      // 检查 dirty 状态
      const { stdout: statusOut } = await execFileAsync(
        'git',
        ['--no-optional-locks', 'status', '--porcelain'],
        { cwd, timeout: 1000 }
      );
      const isDirty = statusOut.trim().length > 0;

      // 获取 ahead/behind
      let ahead = 0;
      let behind = 0;
      try {
        const { stdout: revOut } = await execFileAsync(
          'git',
          ['rev-list', '--left-right', '--count', '@{upstream}...HEAD'],
          { cwd, timeout: 1000 }
        );
        const parts = revOut.trim().split(/\s+/);
        if (parts.length === 2) {
          behind = parseInt(parts[0], 10) || 0;
          ahead = parseInt(parts[1], 10) || 0;
        }
      } catch {
        // No upstream
      }

      return { branch, is_dirty: isDirty, ahead, behind };
    } catch {
      return null;
    }
  }
}
