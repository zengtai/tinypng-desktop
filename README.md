# TinyPNG Desktop

基于 Tauri 2 + React + Rust 的桌面图片压缩工具。通过模拟浏览器请求访问 TinyPNG 免费接口，实现无限制批量压缩和格式转换。

单文件 Portable 应用，无需安装，无系统残留。

## 功能

**压缩与转换**
- 支持输入：PNG / JPEG / WebP / AVIF
- 支持输出：WebP / AVIF / JPEG / PNG / JXL，可同时输出多种格式
- 全局格式选择 + 每张图片单独格式覆盖
- 透明通道检测：原图含透明时自动跳过 JPEG（TinyPNG 不支持此转换），并给出明确提示

**队列控制**
- 无数量限制，自动分批（每批 ≤20 张，批间间隔 600ms）
- 批内并发数可配置（1-5，默认 3）
- 失败自动重试（0-3 次，间隔递增）
- 失败后可查看错误原因，手动点击重试按钮重跑单个格式

**输出设置**
- 保存位置：与原图同目录，或指定任意目录
- 文件名后缀：默认 `_tiny`，支持 `{w}` `{h}` 占位符替换为实际宽高（如 `_{w}x{h}` → `image_800x600.webp`）
- 覆盖原文件模式
- 按格式分文件夹（jpeg 统一归入 `jpg/`）
- 压缩完成后点击结果 tile 可在文件夹中定位文件

**界面**
- 明暗主题切换，默认跟随系统，手动切换后记忆偏好
- 文件拖放使用 Tauri 原生 API
- 设置持久化到程序同目录 `settings.json`，Portable 友好

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | React 18 + TypeScript + Zustand + Vite |
| 桌面框架 | Tauri 2 |
| 后端 | Rust（reqwest / tokio / futures） |
| 构建 | GitHub Actions（windows-latest） |
| 字体 | DM Sans + DM Mono（本地 woff2，离线可用） |

## 使用

下载 `tinypng-desktop.exe`，放在任意目录，双击运行。

配置文件 `settings.json` 会自动生成在 exe 同目录。删除整个文件夹即为完全卸载，无注册表残留。

## 开发

### 前置条件

```bash
# 安装 Rust（https://rustup.rs）
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# 安装 Node.js 18+（https://nodejs.org）
```

### 运行

```bash
npm install
npm run tauri dev
```

### 构建

```bash
npm run tauri build -- --no-bundle
# 产物：src-tauri/target/release/tinypng-desktop.exe
```

## 项目结构

```
tinypng-desktop/
├── src/                          # React 前端
│   ├── App.tsx                   # 主组件：主题切换 / 拖放监听 / 压缩调度
│   ├── App.css                   # 全局样式 + 主题变量
│   ├── assets/fonts/             # 本地字体文件（woff2）
│   ├── components/
│   │   ├── DropZone.tsx          # 初始拖拽区域
│   │   ├── FileCards.tsx         # 文件卡片列表 + 格式 tile（含重试）
│   │   ├── TopBar.tsx            # 顶部工具栏（全局格式选择 / 开始压缩）
│   │   ├── SettingsPanel.tsx     # 设置面板（两栏布局）
│   │   └── StatusBar.tsx         # 底部状态栏
│   ├── stores/appStore.ts        # Zustand 状态管理
│   ├── utils/tauri.ts            # IPC 封装 + 设置持久化
│   └── types/index.ts            # TypeScript 类型
│
└── src-tauri/                    # Rust 后端
    ├── src/
    │   ├── lib.rs                # 核心逻辑（535 行）
    │   │   ├── 类型定义           # CompressTask / FmtResult / AppSettings
    │   │   ├── HTTP 操作          # store_image / process_image / download_image
    │   │   ├── with_retry         # 通用重试高阶函数
    │   │   ├── has_alpha_channel  # 透明通道检测（PNG/WebP/AVIF）
    │   │   ├── build_output_path  # PathBuf 路径构建 + {w}/{h} 占位符
    │   │   ├── compress_task      # 单张图片完整压缩流程
    │   │   └── mod commands       # Tauri 命令（子模块隔离）
    │   └── main.rs               # 入口（含 windows_subsystem 隐藏控制台）
    ├── capabilities/default.json  # Tauri 2 权限
    └── tauri.conf.json            # 应用配置
```

## 核心原理

### TinyPNG 接口

通过抓包确认的真实接口，无需 API Key：

```
1. POST /backend/opt/store     上传原图 → { key, size }
2. POST /backend/opt/process   key + 目标格式 → { url, size, width, height }
3. GET  <url>                  下载压缩后文件
```

同一个 key 可多次 process（每次不同格式），实现一次上传多格式输出。

### 透明通道检测

在上传前通过读取文件头判断是否含透明通道：
- PNG：IHDR chunk 第 25 字节（color_type 4/6/3）
- WebP：扫描 ALPH chunk 或 VP8L 签名
- AVIF/JXL：保守判定为可能含透明

检测到透明时自动跳过 JPEG 输出并提示原因。

### 设置持久化

不使用 `%APPDATA%`，直接读写 exe 同目录的 `settings.json`。
读写由 Rust 命令完成（`std::fs`），绕过 Tauri fs 插件的路径白名单限制。

## 开发备忘

### Tauri 2 注意事项

| 问题 | 解决方案 |
|---|---|
| `crate-type` 含 `staticlib` 导致宏重复定义 | 只保留 `["cdylib", "rlib"]` |
| `#[tauri::command]` 与 `generate_handler!` 命名冲突 | 命令放入 `mod commands {}`，用 `commands::xxx` 引用 |
| `tauri.conf.json` 中 `plugins.dialog` 写 `{}` 报错 | 不需要配置的插件不写任何字段 |
| `tauri-plugin-fs` 无法写 exe 目录 | 改用 Rust `std::fs` 直接读写 |
| WebView 中 `dataTransfer.files.path` 为 undefined | 用 Tauri 原生 `tauri://drag-drop` 事件 |
| CSS `@font-face` 绝对路径加载失败 | 用 `./assets/fonts/` 相对路径 |
| sccache 在 Windows MSVC 下更慢 | 不要用，Swatinem/rust-cache 即可 |

## 注意事项

- 使用 TinyPNG 免费网页端接口，无需 API Key
- **单张图片最大 5MB**（TinyPNG 接口限制），超过的文件会在添加时自动跳过并在状态栏提示
- 请勿设置过高并发或短时间处理大量图片，以免 IP 被限速
- 图片会上传至 TinyPNG 服务器处理，敏感图片请勿使用

## License

MIT
