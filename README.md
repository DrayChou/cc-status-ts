# cc-status-ts

Claude Code 多平台状态栏插件 TypeScript 版本。

## 特性

- **多行状态栏显示** - 利用 Claude Code 插件 API，支持多行输出
- **多平台余额监控** - 支持 DeepSeek, Kimi, GLM, SiliconFlow, Minimaxi, KFC, GAC Code
- **上下文使用率** - 实时显示 context window 使用情况
- **Git 状态** - 显示分支、dirty 状态、ahead/behind
- **缓存复用** - 复用 cc-status Python 版本的缓存机制

## 安装

### 1. 构建项目

```bash
cd scripts/cc-status-ts
npm install
npm run build
```

### 2. 配置 Claude Code

在 `~/.claude/settings.json` 中添加:

```json
{
  "statusLine": {
    "type": "command",
    "command": "node /path/to/cc-status-ts/dist/index.js",
    "refreshInterval": 1000
  }
}
```

## 配置复用

本插件复用 cc-status (Python) 的配置文件:

- `~/.claude/config/platforms.json` - 平台 API 配置
- `~/.claude/config/status.json` - 状态栏显示配置
- `~/.claude/cache/` - 缓存文件

## 支持的平台

| 平台 | 显示格式 |
|------|----------|
| DeepSeek | ¥-0.32 (余额) |
| Kimi | ¥5.19 (余额) |
| GLM | ¥12.34 (余额) |
| SiliconFlow | ¥24.67 (余额) |
| KFC | 5715/7168 (使用次数) |
| Minimaxi | ¥600.00 (余额) |
| GAC Code | 12345/20000 (积分) |

## 显示示例

```
[Opus] │ project git:(main)                            # Line 1: Model + 目录 + Git
Context ████████░░ 67% │ Kimi:¥5.19 │ DeepSeek:¥-0.32 # Line 2: 上下文 + 余额
```

## 开发

```bash
# 安装依赖
npm install

# 开发模式（热重载）
npm run dev

# 构建
npm run build

# 测试
npm test
```

## 架构

参考 claude-hud 插件架构:

- `src/config/` - 配置加载
- `src/cache/` - 缓存管理（兼容 Python 版本）
- `src/platforms/` - 平台 API 调用
- `src/git/` - Git 状态获取
- `src/hud/` - HUD 功能（context, transcript, usage）
- `src/display/` - 显示格式化

## License

MIT
