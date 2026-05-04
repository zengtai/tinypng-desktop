# Changelog

所有版本变更记录。格式遵循 [Keep a Changelog](https://keepachangelog.com/)。

## [0.1.1] - 2026-04-16

### Added
- **透明转 JPEG 背景色** — API 模式下，透明图转 JPEG 时自动填充指定背景色（默认白色），不再直接跳过。免费模式仍提示"使用 API Key 可转换"
- **背景色选择器** — 设置页 API 区域新增颜色选择器，填写 API Key 后显示
- **非图片文件提示** — 拖入不支持的文件格式时，状态栏显示跳过提示
- **API 已用次数** — 使用官方 API 时，状态栏右侧显示本月已用次数（Compression-Count/500）
- **全部重试** — TopBar 新增"重试失败"按钮，一键清除所有失败结果重新处理
- **CHANGELOG.md** — 独立变更日志文件

### Fixed
- **NaN undefined** — 压缩后文件比原文件大时，节省体积显示 NaN。改为正确显示负值（"增加 xx"）
- **永久性错误可重试** — 透明通道和路径冲突导致的错误不再显示重试按钮（重试无意义）
- **官方 API 无法压缩** — shrink 响应的 output URL 在 Location 响应头（非 JSON body），convert 返回图片二进制（非 JSON），宽高在 Image-Width/Height 响应头
- **重试已完成格式** — handleCompress 只发送未完成的格式，不再重跑已成功的

### Changed
- **网络错误友好化** — DNS/超时/连接拒绝/429/401/413 等常见错误映射为中文提示
- **移除 tauri-plugin-shell** — 未使用，从所有配置中移除
- **设置加载去重** — App.tsx 统一加载，移除 SettingsPanel 的独立加载逻辑

## [0.1.0] - 2026-04-14

### Added
- 基于 TinyPNG 免费接口的批量图片压缩
- 多格式同时输出（WebP / AVIF / JPEG / PNG / JXL）
- 自动分批（≤20 张/批）+ 并发控制（1-5）+ 失败重试（0-3 次）
- 自定义保存路径、文件名后缀（支持 {w} {h} 宽高占位符）
- 按格式分文件夹（jpeg 统一归入 jpg/）
- 设置持久化到 exe 同目录 settings.json
- 明暗主题切换，默认跟随系统
- Tauri 原生拖放
- 透明通道检测（PNG/WebP/AVIF）
- 压缩完成后点击 tile 定位文件
- TinyPNG 官方 API Key 支持
- 单文件 Portable 应用，无需安装
