/**
 * 状态栏配置加载
 * 从 ~/.claude/config/status.json 读取
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import type { HudElement, StatusConfig } from '../types.js';

const DEFAULT_ELEMENT_ORDER: HudElement[] = [
  'model',
  'project',
  'context',
  'balance',
  'usage',
  'tools',
  'agents',
  'todos',
];

const DEFAULT_CONFIG: StatusConfig = {
  // 基础显示
  show_balance: true,
  show_model: true,
  show_git_branch: true,
  show_time: false,
  show_session_cost: false,
  show_today_usage: false,
  show_ccusage: false,
  show_directory: true,
  layout: 'expanded',
  auto_wrap: true,

  // HUD 功能（可选行）
  show_context: true,
  show_usage: true,
  show_tools: true,
  show_agents: true,
  show_todos: true,

  // 新增：elementOrder
  elementOrder: [...DEFAULT_ELEMENT_ORDER],

  // 新增：pathLevels
  pathLevels: 1,

  // 新增：颜色配置
  colors: {
    context: 'green',
    usage: 'brightBlue',
    usageWarning: 'brightMagenta',
    warning: 'yellow',
    critical: 'red',
  },

  // 新增：显示控制
  showConfigCounts: true,
  showSpeed: true,
  showTokenBreakdown: false,
  usageThreshold: 0,
  sevenDayThreshold: 80,
  environmentThreshold: 0,
};

export async function loadStatusConfig(): Promise<StatusConfig> {
  const configPath = path.join(os.homedir(), '.claude', 'config', 'status.json');

  if (!fs.existsSync(configPath)) {
    return DEFAULT_CONFIG;
  }

  try {
    const content = fs.readFileSync(configPath, 'utf-8');
    const config = JSON.parse(content) as StatusConfig;
    // 合并默认配置
    return { ...DEFAULT_CONFIG, ...config };
  } catch (error) {
    console.error('[cc-status-ts] Failed to load status config:', error);
    return DEFAULT_CONFIG;
  }
}
