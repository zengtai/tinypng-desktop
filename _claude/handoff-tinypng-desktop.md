# TinyPNG Desktop — 新对话交接文档

---

## 1. 项目总览

**目标**：基于 Tauri 2 + React 18 + TypeScript + Rust 的桌面图片压缩工具。通过模拟浏览器请求访问 TinyPNG 免费接口（也支持官方 API Key），实现无限制批量压缩和格式转换。单文件 Portable 应用，无需安装。

**仓库**：`https://github.com/zengtai/tinypng-desktop`（私有）

**技术栈**：
- 前端：React 18 + TypeScript + Zustand + Vite
- 后端：Rust + Tauri 2
- 构建：GitHub Actions（windows-latest），产物为单个 `tinypng-desktop.exe`
- 字体：DM Sans + DM Mono（本地 woff2，`src/assets/fonts/`）

---

## 2. 已完成的功能

### 核心功能
- 拖放或选择图片（PNG/JPEG/WebP/AVIF），单张最大 5MB
- 多格式同时输出（WebP/AVIF/JPEG/PNG/JXL），全局 + 每张图单独格式选择
- 自动分批（≤20 张/批，批间 600ms），批内并发可配（1-5，默认 3）
- 失败自动重试（0-3 次，间隔递增 1.5s×attempt）
- 透明通道检测（PNG/WebP/AVIF），免费模式跳过 JPEG，API 模式填充背景色转换
- 压缩完成后点击 tile 在文件夹中定位文件

### 两种模式
- **免费接口**（无 Key）：模拟浏览器访问 `tinypng.com/backend/opt/store` + `process`
- **官方 API**（有 Key）：`api.tinify.com/shrink`，支持 `transform.background`，状态栏显示 `API: N/500`

### 输出设置
- 自定义保存目录、文件名后缀（支持 `{w}` `{h}` 宽高占位符）
- 按格式分文件夹（jpeg→`jpg/`）
- 覆盖原文件模式（有安全检查防静默覆盖）
- 设置持久化到 exe 同目录 `settings.json`

### UI
- 明暗主题切换（默认跟随系统，手动切换后记忆，太阳/月亮图标）
- header 只有导航标签 + 主题切换，无 logo
- 设置页两栏布局（输出 | 队列），下方 API 区域
- 版本号在设置页标题行右侧，双击显示作者 logo（链接到 zengtai.net）
- 非图片文件拖入时状态栏黄色提示
- 失败 tile 显示错误原因，可点重试（永久性错误如透明通道不显示重试按钮）
- TopBar "重试失败"按钮一键清除所有 error 重跑
- 网络错误友好中文提示（DNS/超时/429/401 等）

---

## 3. 关键技术决策（踩坑记录）

### Tauri 2 配置规范
| 问题 | 解决方案 |
|---|---|
| `crate-type` 含 `staticlib` 导致宏重复定义 | 只保留 `["cdylib", "rlib"]` |
| `#[tauri::command]` 与 `generate_handler!` 命名冲突 | 命令放入 `mod commands {}`，用 `commands::xxx` 引用 |
| `tauri.conf.json` 中 `plugins.dialog` 写 `{}` 报错 | 不需要配置的插件不写任何字段 |
| `tauri-plugin-fs` 无法写 exe 目录 | 改用 Rust `std::fs` 直接读写 |
| WebView 中 `dataTransfer.files.path` 为 undefined | 用 Tauri 原生 `tauri://drag-drop` 事件 |
| CSS `@font-face` 绝对路径加载失败 | 用 `./assets/fonts/` 相对路径 |
| `<a target="_blank">` 不打开外部浏览器 | 用 Rust 命令 `open_url`（`cmd /c start` / `open` / `xdg-open`） |
| sccache 在 Windows MSVC 下更慢 | 不要用，Swatinem/rust-cache 即可 |
| `shell:allow-open` 已废弃 | 删掉，`tauri-plugin-shell` 完全移除 |

### 构建规范
- `bundle.active: false`，`--no-bundle` 参数，直接输出 exe
- GitHub Actions 上传 `src-tauri/target/release/tinypng-desktop.exe`
- 打包源码时排除：`node_modules/` `.git/` `target/` `src-tauri/icons/`（图标由用户自行管理）

### 官方 API 接口细节
```
POST https://api.tinify.com/shrink
  Auth: Basic base64("api:<key>")
  Body: 图片二进制
  Response: 201, Location 响应头 = output_url, Compression-Count 响应头 = 已用次数

POST <output_url>
  Auth: Basic
  Body: {"convert":{"type":"image/webp"}, "transform":{"background":"#ffffff"}}
  Response: 图片二进制, Content-Type/Image-Width/Image-Height 响应头
```

### 免费接口细节
```
POST https://tinypng.com/backend/opt/store → { key, size }
POST https://tinypng.com/backend/opt/process → { url, size, type, width, height }
  Body: { key, originalType, originalSize, convert: { type: "image/webp" } }
GET <url> → 压缩后图片二进制
```

---

## 4. 用户偏好和约束

- **打包排除 icons**：每次打包源码不包含 `src-tauri/icons/`，因为 Claude 处理透明 PNG 有问题（上传后透明变黑底），用户自行管理图标文件
- **单文件 Portable**：不需要安装包，不需要卸载程序，配置文件存 exe 同目录
- **低调署名**：双击版本号才显示作者 logo，链接到 `https://zengtai.net/`
- **logo 文件**：`src/assets/logo.png`，16x16 PNG，由用户自己替换
- **构建时间敏感**：用户希望先预览再推送（每次 Actions 构建约 5-7 分钟）
- **中文界面**
- **作者个人网站**：https://zengtai.net/

---

## 5. 当前进行中的任务（未完成）

用户请求了以下修改，尚未写入代码：

### 5.1 去掉作者 logo 的鼠标 hover 提示
`SettingsPanel.tsx` 中 `.s-author-link` 的 `data-tip` 和对应的 CSS `::after` tooltip 需要删除。tooltip 会撑开父级宽度产生横向滚动条。

### 5.2 版本号移到顶部 header 行
把 `v0.1.1` 从设置页标题行移到 `App.tsx` 的 header 行（和"压缩"/"设置"标签、明暗切换按钮同一行），设置页去掉 `<h2>设置</h2>` 标题和 `.s-header` 整个区域，腾出空间避免最小窗口时出现纵向滚动条。

### 5.3 API Key 输入框加清除按钮
设置页 API Key 输入框旁边加一个清除按钮（×），快速清空 key。粘贴按钮用户觉得可能多余，暂不加。

---

## 6. 未解决的问题 / 待讨论

- macOS / Linux 多平台支持暂不做（macOS 需要代码签名 $99/年）
- 完成提示音 / 通知 — 暂不做
- 键盘 Delete 删除 — 暂不做
- 自定义文件夹名称（如 @1x @2x）— 暂不做
- 大批量进度百分比 — 暂不做

---

## 7. 关键文件路径和结构

```
tinypng-desktop/
├── src/
│   ├── App.tsx                   # 主组件（194行）：主题/拖放/压缩调度
│   ├── App.css                   # 全局样式+主题变量（207行）
│   ├── assets/
│   │   ├── fonts/                # 5个woff2字体文件
│   │   └── logo.png              # 作者logo 16x16（需用户自己替换）
│   ├── components/
│   │   ├── DropZone.tsx          # 初始拖拽区域（55行）
│   │   ├── FileCards.tsx         # 文件卡片+格式tile+重试（149行）
│   │   ├── TopBar.tsx            # 工具栏：格式选择/开始压缩/重试失败（73行）
│   │   ├── SettingsPanel.tsx     # 设置面板：两栏+API区域（190行）
│   │   └── StatusBar.tsx         # 状态栏：进度/节省/API计数（58行）
│   ├── stores/appStore.ts        # Zustand状态管理（137行）
│   ├── utils/
│   │   ├── tauri.ts              # IPC封装+设置持久化（64行）
│   │   ├── format.ts             # formatBytes等工具函数
│   │   └── uuid.ts               # UUID生成
│   └── types/index.ts            # TS类型定义（44行）
│
├── src-tauri/
│   ├── src/lib.rs                # Rust核心逻辑（772行）
│   ├── src/main.rs               # 入口（含windows_subsystem）
│   ├── Cargo.toml                # crate-type=["cdylib","rlib"]
│   ├── capabilities/default.json # 权限：core/fs/dialog（无shell）
│   └── tauri.conf.json           # bundle.active=false
│
├── .github/workflows/build.yml   # Actions: --no-bundle, 上传exe
├── README.md
├── CHANGELOG.md
└── package.json                  # 无@tauri-apps/plugin-shell
```

### Rust lib.rs 结构（772行）
```
Types:        CompressTask / FmtResult / AppSettings（含api_key, bg_color）
Structs:      StoreResponse / ProcessResponse / ShrinkResult / OfficialDownload
Helpers:      build_client / base_headers / fmt_to_mime / mime_to_ext
              with_retry / friendly_error / has_alpha_channel
              build_output_path（PathBuf + {w}/{h}占位符）
              resolve_suffix / make_result / emit_fmt
Free API:     store_image / process_image / download_image
Official API: shrink_official / convert_official（含transform.background）
              base64_encode / basic_auth / parse_header_u32
Core:         UploadResult enum / compress_task（分流Free/Official两条路径）
Commands:     mod commands { get_settings / save_settings / compress_images /
              open_folder / open_url / load_settings_file / save_settings_file /
              clear_settings_file }
Entry:        pub fn run()
```

### AppSettings 完整字段
```rust
pub struct AppSettings {
    pub output_dir: Option<String>,     // 输出目录，None=原图同目录
    pub output_suffix: String,          // 默认 "_tiny"，支持{w}{h}
    pub overwrite_original: bool,       // 默认 false
    pub fmt_folder: bool,               // 默认 false
    pub max_concurrent: usize,          // 默认 3，范围1-5
    pub retry_count: u32,               // 默认 2，范围0-3
    pub api_key: Option<String>,        // 默认 None
    pub bg_color: String,               // 默认 "#ffffff"
}
```

---

## 8. 推荐的下一步

### 立即要做（第5节未完成的任务）
1. 删除 `.s-author-link` 的 `data-tip` 属性和 `::after` tooltip CSS
2. 将版本号 `v0.1.1` 移到 `App.tsx` header 行右侧（紧挨主题切换按钮左边）
3. 删除 `SettingsPanel.tsx` 的 `<h2>设置</h2>` 和 `.s-header` 包裹层
4. API Key 输入框右侧加清除按钮（×）

### 改完后
- 打包源码时排除 `node_modules/` `.git/` `target/` `src-tauri/icons/`
- 给用户预览效果后再让他推送构建
- 更新 CHANGELOG.md

---

## 9. 给下一个 AI 的指令

### 必须遵守的规范
1. **Cargo.toml**: `crate-type = ["cdylib", "rlib"]`，绝不加 `staticlib`
2. **所有 `#[tauri::command]` 函数**放在 `mod commands {}` 子模块，`generate_handler!` 用 `commands::xxx`
3. **tauri.conf.json plugins**: 只有 `fs` 可以有配置，其他插件不写任何字段
4. **文件写入**：用 Rust `std::fs`，不用 `tauri-plugin-fs`（白名单限制）
5. **拖放**：用 `tauri://drag-drop` 事件，不用 `dataTransfer.files`
6. **字体路径**：`./assets/fonts/` 相对路径
7. **外部链接**：用 Rust `open_url` 命令，不用 `<a target="_blank">`
8. **打包排除 icons**：zip 命令加 `-x "*/src-tauri/icons/*"`
9. **不用 sccache**（Windows MSVC 下更慢）
10. **构建命令**：`npm run tauri build -- --no-bundle`，bundle.active=false

### 工作流程
- 修改代码后先提供预览（用 `visualize:show_widget`），用户确认后再打包
- 打包命令：`cd /home/claude && zip -r /mnt/user-data/outputs/tinypng-desktop-source.zip tinypng-desktop/ -x "*/node_modules/*" -x "*/.git/*" -x "*/target/*" -x "*/src-tauri/icons/*"`
- 用 `present_files` 提供下载
- 每次功能变更同步更新 `CHANGELOG.md`

### 用户沟通风格
- 中文交流
- 喜欢简洁直接的回答
- 会主动提出 UI/UX 改进建议
- 对代码质量有要求（DRY、PathBuf、友好错误信息等）
- 会先确认方案再写代码
