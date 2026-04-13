# TinyPNG Desktop

一个基于 **Tauri 2 + React + Rust** 的桌面图片压缩工具，通过模拟浏览器行为访问 TinyPNG，实现无限制批量压缩。

## ✨ 功能特性

- **无数量限制**：自动将图片分成每批 ≤20 张的队列，完全绕过 TinyPNG 的网页端限制
- **格式转换**：压缩同时可转换为 WebP / AVIF / PNG / JPEG
- **并发控制**：每批内可设置 1-5 张同时上传（建议 3）
- **自定义输出目录**：可保存到与原图相同目录，或指定任意目录
- **文件名后缀**：默认 `_tiny`，可自定义，也可开启覆盖原文件模式
- **每张单独设置格式**：在文件列表里可为每张图片单独指定输出格式
- **失败重试**：网络波动时自动重试
- **拖拽支持**：拖入文件或文件夹

## 🛠 技术栈

| 层 | 技术 |
|---|---|
| 前端 UI | React 18 + TypeScript + Zustand |
| 桌面框架 | Tauri 2 |
| 核心逻辑 | Rust (reqwest, tokio, futures) |
| HTTP 模拟 | reqwest 带浏览器 UA + cookie store |

## 📦 安装依赖

### 前置条件

```bash
# 1. 安装 Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# 2. 安装 Node.js 18+
# https://nodejs.org

# 3. macOS 额外依赖
xcode-select --install

# 4. Linux 额外依赖
sudo apt install libwebkit2gtk-4.1-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev
```

### 安装 & 运行

```bash
# 克隆项目
git clone <repo> tinypng-desktop
cd tinypng-desktop

# 安装前端依赖
npm install

# 开发模式
npm run tauri dev

# 构建发布版本
npm run tauri build
```

## 🏗 项目结构

```
tinypng-desktop/
├── src/                        # React 前端
│   ├── components/
│   │   ├── DropZone.tsx        # 拖拽区域
│   │   ├── FileList.tsx        # 文件列表（含格式选择）
│   │   ├── Toolbar.tsx         # 操作栏
│   │   ├── SettingsPanel.tsx   # 设置面板
│   │   └── StatusBar.tsx       # 底部状态栏
│   ├── stores/
│   │   └── appStore.ts         # Zustand 全局状态
│   ├── utils/
│   │   ├── tauri.ts            # Tauri IPC 封装
│   │   ├── format.ts           # 格式化工具
│   │   └── uuid.ts             # UUID 生成
│   └── types/index.ts          # TypeScript 类型定义
│
└── src-tauri/                  # Rust 后端
    └── src/
        └── lib.rs              # 核心逻辑：
                                #   - compress_single()  单图压缩
                                #   - compress_images()  批量队列入口
                                #   - save_result()      写入文件
                                #   - Tauri commands
```

## ⚙️ 核心原理

### 绕过 20 张限制

TinyPNG 网页端通过前端 JS 限制一次最多选择 20 张。本工具直接模拟浏览器的 multipart/form-data 请求，服务端本身没有此限制。

```rust
// 每批 20 张，自动分批
let batches: Vec<Vec<CompressTask>> = tasks
    .chunks(20)
    .map(|c| c.to_vec())
    .collect();

// 每批内并发处理（默认 3 个同时）
stream::iter(batch)
    .map(|task| compress_single(...))
    .buffer_unordered(max_concurrent)
    .collect()
    .await;
```

### 格式转换

压缩完成后，向 TinyPNG 的输出 URL POST 一个转换请求：

```json
{ "convert": { "type": ["webp"] } }
```

服务端返回新的下载 URL，再下载即可。

### 事件驱动 UI

Rust 后端通过 Tauri 事件系统实时推送每张图片的状态变更：

```rust
app.emit("task-update", json!({
    "id": id,
    "status": "done",
    "compressed_size": 12345,
    "saved_percent": 42.5,
    "output_path": "/path/to/image_tiny.png"
}));
```

前端监听并更新对应行的状态，无需轮询。

## 🔧 设置说明

| 设置项 | 说明 |
|---|---|
| 保存位置 | 留空则保存在原图同目录 |
| 文件名后缀 | 默认 `_tiny`，开启覆盖时忽略 |
| 默认输出格式 | 对所有新添加的图片生效；可在列表里单独覆盖 |
| 并发数量 | 建议 3，过高可能被限速 |
| 失败重试 | 推荐 2 次，网络不稳定时有效 |

## ⚠️ 注意事项

- 本工具使用 TinyPNG 的**免费网页端接口**（无需 API Key），与直接在浏览器使用 tinypng.com 相同
- 请勿滥用（如设置极高并发、无休止循环压缩），以免 IP 被临时限速
- 图片数据会上传至 TinyPNG 的服务器进行处理，敏感图片请勿使用

## 📄 License

MIT
