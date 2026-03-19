# cc-status-ts 项目规范

## 项目概述

Claude Code 多平台状态栏插件 TypeScript 版本，参考 claude-hud 架构实现多行状态栏显示。

## 技术栈

- TypeScript 5.x + ESM
- Node.js 18+
- 无外部运行时依赖

## 项目结构

```
src/
├── index.ts           # 主入口
├── types.ts           # 类型定义
├── session/           # Session 信息读取
├── config/            # 配置加载
├── cache/             # 缓存管理
├── platforms/         # 平台 API
│   └── impl/          # 各平台实现
├── git/               # Git 状态
├── hud/               # HUD 功能（待实现）
└── display/           # 显示格式化
```

## 开发规范

### TypeScript
- 严格模式开启
- 必须有类型注解
- 禁止使用 `any`
- 使用 `interface` 优于 `type`

### 命名
- 变量/函数: camelCase
- 类/类型: PascalCase
- 常量: UPPER_SNAKE_CASE

### 错误处理
- 使用 `unknown` 捕获未知错误
- 错误信息添加上下文前缀 `[cc-status-ts]`

## 构建命令

```bash
npm run build   # 编译 TypeScript
npm run dev     # 开发模式 (tsx)
npm test        # 测试
```

## Claude Code 插件配置

```json
{
  "statusLine": {
    "type": "command",
    "command": "node /path/to/cc-status-ts/dist/index.js",
    "refreshInterval": 1000
  }
}
```

## 参考

- claude-hud: https://github.com/jarrodwatts/claude-hud
- cc-status (Python): ../cc-status/
