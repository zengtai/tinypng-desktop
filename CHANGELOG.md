**English** | [中文](./CHANGELOG.zh-CN.md)

# Changelog

All notable changes to this project. Format follows [Keep a Changelog](https://keepachangelog.com/).

## [0.2.0] - 2026-05-13

### Added

- **i18n** — Language toggle (中/EN) in header, switches at runtime, persisted
- **Folder drop** — Drag & drop folders, recursively scans all subdirectories for images
- **Custom UI font** — Font input in settings, leave empty for system default
- **API Key clear button** — × button next to API Key input for quick clearing
- **Remember format selection** — Global format choices auto-saved and restored on next launch

### Changed

- **Version in header** — Moved from settings page to header bar alongside nav tabs and theme toggle
- **Simplified settings** — Removed settings page title area to prevent scrollbars at minimum window size
- **Removed bundled fonts** — Replaced DM Sans / DM Mono woff2 with system font stack + CSS variables
- **SVG logo** — Switched author logo from `logo.png` to `logo.svg`
- **Repo link** — Double-click version number now links to GitHub repository
- **No CMD flash** — Windows uses `ShellExecuteW` instead of `cmd /c start` for opening URLs
- **i18n error codes** — Rust returns error codes, frontend translates based on locale
- **Responsible usage wording** — Removed "unlimited" claims, noted free API may break with website changes
- **Larger minimum window** — 800×600 → 860×660 to prevent scrollbars on settings page
- **Consistent spacing** — Unified footer button spacing with section gaps

## [0.1.1] - 2026-04-16

### Added

- **Transparent → JPEG background** — API mode auto-fills background color (default white) for transparent images converting to JPEG
- **Color picker** — Background color picker in settings, visible when API Key is set
- **Non-image feedback** — Status bar notification when unsupported files are dropped
- **API usage count** — Status bar shows monthly compression count (N/500) when using official API
- **Retry all** — "Retry failed" button in toolbar to re-process all failed items

### Fixed

- **NaN display** — Correctly shows "increased" instead of NaN when compressed file is larger than original
- **Permanent errors** — Transparency and path conflict errors no longer show retry button
- **Official API parsing** — Fixed output URL from Location header, binary response handling, width/height from headers
- **Skip completed** — handleCompress only sends pending formats, no longer re-runs successful ones

### Changed

- **Friendly errors** — DNS/timeout/connection/429/401/413 errors mapped to human-readable messages
- **Removed tauri-plugin-shell** — Unused dependency removed from all configs
- **Unified settings load** — Single load in App.tsx, removed duplicate in SettingsPanel

## [0.1.0] - 2026-04-14

### Added

- Batch image compression via TinyPNG free web API
- Multi-format output (WebP / AVIF / JPEG / PNG / JXL)
- Auto-batching (≤20/batch) + concurrency control (1–5) + auto-retry (0–3)
- Custom output path, filename suffix (with {w} {h} placeholders)
- Organize output by format in subfolders (jpeg → `jpg/`)
- Settings persisted to `settings.json` next to executable
- Light / Dark theme, follows system preference
- Native Tauri drag & drop
- Transparency detection (PNG / WebP / AVIF)
- Click result tile to reveal file in explorer
- TinyPNG official API Key support
- Single-file portable app, no installation required
