/**
 * 状态栏渲染
 */
import type { RenderContext, StatusConfig } from '../types.js';
import { formatBalance, formatGit, formatModel, formatContextBar } from './formatter.js';
import { loadPlatformsConfig } from '../config/platforms.js';
import { visualLength, quotaBar, dim } from './colors.js';

/**
 * 获取终端宽度
 * Claude Code 状态栏大约 60-80 字符宽
 */
function getTerminalWidth(): number {
  if (process.stdout.columns && process.stdout.columns > 0) {
    return Math.min(process.stdout.columns - 2, 80); // 保留边距，最多80
  }
  return 60; // Claude Code 默认宽度
}

export async function renderStatus(ctx: RenderContext, config: StatusConfig): Promise<string[]> {
  const lines: string[] = [];
  const terminalWidth = getTerminalWidth();

  // 获取平台名称映射
  const platformsConfig = await loadPlatformsConfig();

  // Line 1: Model + Directory + Git
  const line1 = renderLine1(ctx, config);
  if (line1) lines.push(line1);

  // Line 2: Context Bar (单独一行)
  const contextBar = renderContextBar(ctx, config);
  if (contextBar) lines.push(contextBar);

  // Line 3: Usage (按宽度换行)
  const usageLines = renderUsageLine(ctx, config, terminalWidth);
  lines.push(...usageLines);

  // Line 4+: Balances (按宽度换行，不与 Context 混合)
  const balanceLines = renderBalances(ctx, config, platformsConfig, terminalWidth);
  lines.push(...balanceLines);

  // Line: Tools Activity (optional)
  if (config.show_tools && ctx.transcript?.tools.length) {
    const toolsLine = renderToolsLine(ctx.transcript.tools);
    if (toolsLine) lines.push(toolsLine);
  }

  // Line: Agents Activity (optional)
  if (config.show_agents && ctx.transcript?.agents.length) {
    const agentsLine = renderAgentsLine(ctx.transcript.agents);
    if (agentsLine) lines.push(agentsLine);
  }

  // Line: Todos Progress (optional)
  if (config.show_todos && ctx.transcript?.todos.length) {
    const todosLine = renderTodosLine(ctx.transcript.todos);
    if (todosLine) lines.push(todosLine);
  }

  // Line: Environment Info (optional) - 配置统计
  const envLine = renderEnvironmentLine(ctx, config);
  if (envLine) lines.push(envLine);

  return lines;
}

function renderLine1(ctx: RenderContext, config: StatusConfig): string {
  const parts: string[] = [];

  // Model
  if (config.show_model) {
    const model = formatModel(ctx.session);
    if (model) parts.push(model);
  }

  // Directory
  if (config.show_directory && ctx.session?.workspace?.current_dir) {
    const dir = ctx.session.workspace.current_dir.split('/').pop() || '';
    parts.push(dir);
  }

  // Git
  if (config.show_git_branch && ctx.git) {
    parts.push(formatGit(ctx.git));
  }

  return parts.join(' │ ');
}

/**
 * 渲染 Context Bar (单独一行)
 */
function renderContextBar(ctx: RenderContext, config: StatusConfig): string | null {
  if (!config.show_context) return null;
  return formatContextBar(ctx);
}

/**
 * 渲染 Usage (按宽度换行)
 */
function renderUsageLine(ctx: RenderContext, config: StatusConfig, terminalWidth: number): string[] {
  if (!config.show_usage || !ctx.usage) return [];

  const parts = formatUsageParts(ctx.usage);
  if (parts.length === 0) return [];

  return wrapByWidth(parts, terminalWidth);
}

/**
 * 渲染 Balances (按宽度换行)
 */
function renderBalances(
  ctx: RenderContext,
  config: StatusConfig,
  platformsConfig: Awaited<ReturnType<typeof loadPlatformsConfig>>,
  terminalWidth: number
): string[] {
  if (!config.show_balance) return [];

  const parts = renderBalancesParts(ctx, platformsConfig);
  if (parts.length === 0) return [];

  // 按宽度智能换行
  return wrapByWidth(parts, terminalWidth);
}

/**
 * 按宽度智能换行 - 使用视觉宽度计算
 */
function wrapByWidth(parts: string[], maxWidth: number): string[] {
  const lines: string[] = [];
  const separator = ' │ ';

  let currentLine = '';
  let currentLength = 0;

  for (const part of parts) {
    const partLength = visualLength(part); // 使用视觉宽度
    const sepLength = currentLine ? visualLength(separator) : 0;
    const newLength = currentLength + sepLength + partLength;

    // 如果加上这个部分会超出宽度
    if (currentLine && newLength > maxWidth) {
      lines.push(currentLine);
      currentLine = part;
      currentLength = partLength;
    } else if (currentLine) {
      currentLine += separator + part;
      currentLength = newLength;
    } else {
      currentLine = part;
      currentLength = partLength;
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}

function renderBalancesParts(
  ctx: RenderContext,
  _platformsConfig: Awaited<ReturnType<typeof loadPlatformsConfig>>
): string[] {
  const balanceParts: string[] = [];

  for (const [id, balance] of Object.entries(ctx.platforms)) {
    const name = balance.name || _platformsConfig.platforms[id]?.name || id;
    const formatted = formatBalance(id, balance, name);
    balanceParts.push(formatted);
  }

  return balanceParts;
}

function renderToolsLine(tools: Array<{ name: string; target?: string; status: string }>): string {
  // 只显示最近的活动工具
  const recentTools = tools.slice(-5);
  const parts: string[] = [];

  for (const tool of recentTools) {
    const statusIcon = tool.status === 'completed' ? '✓' : tool.status === 'error' ? '✗' : '◐';
    const name = tool.name;
    const target = tool.target ? `:${tool.target.split('/').pop()}` : '';
    parts.push(`${statusIcon} ${name}${target}`);
  }

  return parts.join(' │ ');
}

function renderAgentsLine(agents: Array<{ type: string; description?: string; status: string }>): string {
  const recentAgents = agents.slice(-3);
  const parts: string[] = [];

  for (const agent of recentAgents) {
    const statusIcon = agent.status === 'completed' ? '✓' : '◐';
    const name = agent.type || 'agent';
    const desc = agent.description ? `:${agent.description.slice(0, 20)}` : '';
    parts.push(`${statusIcon} ${name}${desc}`);
  }

  return parts.join(' │ ');
}

function renderTodosLine(todos: Array<{ content: string; status: string }>): string {
  const completed = todos.filter(t => t.status === 'completed').length;
  const total = todos.length;
  const inProgress = todos.find(t => t.status === 'in_progress');
  const current = inProgress || todos.find(t => t.status === 'pending');

  const progress = `${completed}/${total}`;
  const content = current ? `:${current.content.slice(0, 30)}` : '';

  return `▸ ${content} (${progress})`;
}

/**
 * 格式化 Usage 为部分数组
 */
function formatUsageParts(usage: { planName: string | null; fiveHour: number | null; sevenDay: number | null }): string[] {
  const parts: string[] = [];

  if (usage.planName) {
    parts.push(usage.planName);
  }

  if (usage.fiveHour !== null) {
    const bar = quotaBar(usage.fiveHour, 8); // 使用 claude-hud 的 quotaBar
    parts.push(`5h ${bar} ${usage.fiveHour.toFixed(0)}%`);
  }

  if (usage.sevenDay !== null) {
    const bar = quotaBar(usage.sevenDay, 8);
    parts.push(`7d ${bar} ${usage.sevenDay.toFixed(0)}%`);
  }

  return parts;
}

/**
 * 渲染环境信息行 - 显示 claude.md/rules/MCPs/hooks 数量
 */
function renderEnvironmentLine(ctx: RenderContext, config: StatusConfig): string | null {
  // 检查是否显示配置统计
  if (config.showConfigCounts === false) {
    return null;
  }

  const claudeMdCount = ctx.claudeMdCount ?? 0;
  const rulesCount = ctx.rulesCount ?? 0;
  const mcpCount = ctx.mcpCount ?? 0;
  const hooksCount = ctx.hooksCount ?? 0;

  const totalCounts = claudeMdCount + rulesCount + mcpCount + hooksCount;
  const threshold = config.environmentThreshold ?? 0;

  if (totalCounts === 0 || totalCounts < threshold) {
    return null;
  }

  const parts: string[] = [];

  if (claudeMdCount > 0) {
    parts.push(`${claudeMdCount} CLAUDE.md`);
  }

  if (rulesCount > 0) {
    parts.push(`${rulesCount} rules`);
  }

  if (mcpCount > 0) {
    parts.push(`${mcpCount} MCPs`);
  }

  if (hooksCount > 0) {
    parts.push(`${hooksCount} hooks`);
  }

  if (parts.length === 0) {
    return null;
  }

  return dim(parts.join(' | '));
}
