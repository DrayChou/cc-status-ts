/**
 * 类型定义
 */

/**
 * Session 信息 (来自 Claude Code stdin)
 */
export interface SessionInfo {
  session_id?: string;
  transcript_path?: string;
  model?: {
    id?: string;
    display_name?: string;
  };
  workspace?: {
    current_dir?: string;
  };
  context_window?: {
    context_window_size?: number;
    current_usage?: {
      input_tokens?: number;
      output_tokens?: number;
      cache_creation_input_tokens?: number;
      cache_read_input_tokens?: number;
    } | null;
    used_percentage?: number | null;
    remaining_percentage?: number | null;
  };
}

/**
 * 平台配置
 */
export interface PlatformConfig {
  name: string;
  platform_type: string;
  api_base_url: string;
  api_key?: string;
  auth_token?: string;
  login_token?: string;
  model: string;
  enabled: boolean;
}

/**
 * 平台配置集合
 */
export interface PlatformsConfig {
  version?: string;
  last_updated?: string;
  platforms: Record<string, PlatformConfig>;
  default_platform: string;
  aliases?: Record<string, string>;
}

/**
 * 状态栏配置
 */
export type HudElement = 'model' | 'project' | 'context' | 'balance' | 'usage' | 'tools' | 'agents' | 'todos';
export type HudColorName = 'red' | 'green' | 'yellow' | 'magenta' | 'cyan' | 'brightBlue' | 'brightMagenta';

export interface StatusConfig {
  // 基础显示
  show_balance: boolean;
  show_model: boolean;
  show_git_branch: boolean;
  show_time: boolean;
  show_session_cost: boolean;
  show_today_usage: boolean;
  show_ccusage: boolean;
  show_directory: boolean;
  layout: 'single_line' | 'multi_line' | 'expanded';
  auto_wrap: boolean;

  // HUD 功能（可选行）
  show_context: boolean;
  show_usage: boolean;
  show_tools: boolean;
  show_agents: boolean;
  show_todos: boolean;

  // 新增：elementOrder - 元素显示顺序
  elementOrder?: HudElement[];

  // 新增：pathLevels - 路径显示深度
  pathLevels?: 1 | 2 | 3;

  // 新增：颜色配置
  colors?: {
    context?: HudColorName;
    usage?: HudColorName;
    usageWarning?: HudColorName;
    warning?: HudColorName;
    critical?: HudColorName;
  };

  // 新增：显示控制
  showConfigCounts?: boolean;
  showSpeed?: boolean;
  showTokenBreakdown?: boolean;
  usageThreshold?: number;
  sevenDayThreshold?: number;
  environmentThreshold?: number;

  [key: string]: unknown;
}

/**
 * 平台余额数据
 */
export interface PlatformBalance {
  platform: string;
  name?: string;
  balance: number;
  currency: string;
  unit?: string;
  display: string;
  color?: 'green' | 'yellow' | 'red';
  error?: string;
  stale?: boolean;
  staleAgeMs?: number;
}

/**
 * Git 状态
 */
export interface GitInfo {
  branch: string;
  is_dirty: boolean;
  ahead: number;
  behind: number;
  stashed?: number;
}

/**
 * 渲染上下文
 */
export interface RenderContext {
  session: SessionInfo | null;
  platforms: Record<string, PlatformBalance>;
  git: GitInfo | null;
  config: StatusConfig;
  timestamp: number;
  // HUD 扩展数据
  context?: {
    usedPercentage: number | null;
  } | null;
  usage?: {
    planName: string | null;
    fiveHour: number | null;
    sevenDay: number | null;
    fiveHourResetAt?: Date | null;
    sevenDayResetAt?: Date | null;
  } | null;
  transcript?: {
    tools: Array<{ name: string; target?: string; status: string }>;
    agents: Array<{ type: string; description?: string; status: string }>;
    todos: Array<{ content: string; status: string }>;
    sessionStart?: Date;
    sessionName?: string;
  };
  // 新增：配置统计
  claudeMdCount?: number;
  rulesCount?: number;
  mcpCount?: number;
  hooksCount?: number;
  sessionDuration?: string;
  // 速度 (tok/s)
  speed?: number | null;
}
