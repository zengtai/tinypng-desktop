[English](./README.md) | **中文**

# TinyPNG Desktop

基于 Tauri 2 + React + Rust 的桌面图片压缩工具。支持通过 TinyPNG 免费接口或官方 API Key 进行批量压缩和格式转换。

单文件 Portable 应用，无需安装，无系统残留。

## 功能

**压缩与转换**

- 支持输入：PNG / JPEG / WebP / AVIF
- 支持输出：WebP / AVIF / JPEG / PNG / JXL，可同时输出多种格式
- 全局格式选择 + 每张图片单独格式覆盖
- 格式选择自动记忆，下次启动恢复
- 透明通道检测：原图含透明时自动跳过 JPEG，并给出明确提示

**队列控制**

- 自动分批（每批 ≤20 张，批间间隔 600ms）
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

- 中英文切换，运行时即时生效
- 明暗主题切换，默认跟随系统，手动切换后记忆偏好
- 自定义界面字体
- 支持拖放文件和文件夹（自动递归遍历子目录）
- 设置持久化到程序同目录 `settings.json`，Portable 友好

## 技术栈

| 层       | 技术                                   |
| -------- | -------------------------------------- |
| 前端     | React 18 + TypeScript + Zustand + Vite |
| 桌面框架 | Tauri 2                                |
| 后端     | Rust（reqwest / tokio / futures）      |
| 构建     | GitHub Actions（windows-latest）       |
| 多语言   | 中文 / English，运行时切换             |

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

## 注意事项

- **免费接口**基于 TinyPNG 网页端逆向，可能随网站更新而失效，不保证长期可用。建议有稳定需求的用户使用官方 API Key（每月 500 张免费额度）
- **单张图片最大 5MB**（TinyPNG 接口限制），超过的文件会在添加时自动跳过并在状态栏提示
- 请勿设置过高并发或短时间处理大量图片，以免 IP 被限速
- 图片会上传至 TinyPNG 服务器处理，敏感图片请勿使用

## 更新日志

详见 [CHANGELOG](./CHANGELOG.zh-CN.md)

## License

MIT
