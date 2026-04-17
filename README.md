# TinyPNG Desktop

基于 Tauri 2 + React + Rust 的桌面图片压缩工具，通过模拟浏览器行为访问 TinyPNG，实现无限制批量压缩。

## 功能特性

- **无数量限制** — 自动分批（每批 ≤20 张），完全绕过网页端限制
- **多格式输出** — 同一张图片同时压缩输出 WebP / AVIF / JPEG / PNG / JXL
- **并发控制** — 每批内可设置 1-5 张同时上传
- **自定义输出** — 保存路径、文件名后缀（支持 `{w}` `{h}` 宽高占位符）、按格式分文件夹
- **设置持久化** — 配置保存在程序同目录 `settings.json`，Portable 友好
- **明暗模式** — 支持亮色/暗色主题切换，偏好自动记忆
- **原生拖放** — 使用 Tauri 原生拖放 API，正确获取文件系统路径

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 UI | React 18 + TypeScript + Zustand + Vite |
| 桌面框架 | Tauri 2 |
| 后端逻辑 | Rust（reqwest / tokio / futures） |
| 构建 | GitHub Actions（windows-latest） |

## 开发

### 前置条件

```bash
# 安装 Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# 安装 Node.js 18+（https://nodejs.org）
```

### 运行 & 构建

```bash
npm install

# 开发模式
npm run tauri dev

# 构建发布版本（Windows）
npm run tauri build
```

## 项目结构

```
tinypng-desktop/
├── src/                        # React 前端
│   ├── components/
│   │   ├── DropZone.tsx        # 拖拽区域
│   │   ├── FileCards.tsx       # 文件卡片列表
│   │   ├── TopBar.tsx          # 顶部工具栏（格式选择 / 开始压缩）
│   │   ├── SettingsPanel.tsx   # 设置面板
│   │   └── StatusBar.tsx       # 底部状态栏
│   ├── stores/appStore.ts      # Zustand 全局状态
│   ├── utils/tauri.ts          # Tauri IPC 封装 + 设置持久化
│   └── types/index.ts          # TypeScript 类型定义
│
└── src-tauri/
    ├── src/lib.rs              # Rust 核心：压缩队列 / 文件写入 / Tauri 命令
    ├── capabilities/           # Tauri 2 权限配置
    └── tauri.conf.json         # 应用配置
```

## 核心原理

### TinyPNG 接口调用

通过抓包确认的真实接口，无需 API Key：

```
POST https://tinypng.com/backend/opt/store    → 上传原图，返回 { key, size }
POST https://tinypng.com/backend/opt/process  → 传入 key + 目标格式，返回下载 URL
GET  <下载 URL>                               → 获取压缩/转换后的文件
```

同一个 `key` 可以多次 `process`，每次指定不同格式，实现一次上传多格式输出。

### 分批并发

```rust
// 每批 20 张，批间间隔 600ms 避免限速
let batches: Vec<Vec<CompressTask>> = tasks.chunks(20).map(|c| c.to_vec()).collect();

// 批内并发（默认 3）
stream::iter(batch)
    .map(|task| compress_task(...))
    .buffer_unordered(max_concurrent)
    .collect::<Vec<_>>()
    .await;
```

### 设置持久化

不使用系统 AppData，直接读写 exe 同目录的 `settings.json`，Portable 版本开箱即用，卸载无残留。

读写由 Rust 命令完成（`load_settings_file` / `save_settings_file`），绕过 Tauri fs 插件的路径白名单限制。

## 注意事项

- 本工具使用 TinyPNG 免费网页端接口，与直接在浏览器使用 tinypng.com 相同，无需 API Key
- 请勿设置过高并发或短时间内处理大量图片，以免 IP 被临时限速
- 图片会上传至 TinyPNG 服务器处理，敏感图片请勿使用

## License

MIT
