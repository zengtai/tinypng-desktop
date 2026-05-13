**English** | [中文](./README.zh-CN.md)

# TinyPNG Desktop

A desktop image compression tool built with Tauri 2 + React + Rust. Supports batch compression and format conversion via TinyPNG's free web API or official API Key.

Single-file portable app — no installation required, no system leftovers.

## Features

**Compression & Conversion**

- Input: PNG / JPEG / WebP / AVIF
- Output: WebP / AVIF / JPEG / PNG / JXL — multiple formats at once
- Global format selection + per-image format override
- Format selection persisted across sessions
- Transparency detection: auto-skips JPEG for transparent images with clear feedback

**Queue Control**

- Auto-batching (≤20 images/batch, 600ms between batches)
- Configurable concurrency (1–5, default 3)
- Auto-retry on failure (0–3 times, increasing interval)
- View error details and retry individual formats

**Output Settings**

- Save to: same directory as source, or any custom directory
- Filename suffix: default `_tiny`, supports `{w}` `{h}` placeholders (e.g. `_{w}x{h}` → `image_800x600.webp`)
- Overwrite original mode
- Organize by format in subfolders (jpeg → `jpg/`)
- Click result tile to reveal file in explorer

**Interface**

- Chinese / English switching at runtime
- Light / Dark theme, follows system by default, remembers manual choice
- Custom UI font
- Drag & drop files and folders (recursively scans subdirectories)
- Settings persisted to `settings.json` next to the executable

## Tech Stack

| Layer    | Technology                             |
| -------- | -------------------------------------- |
| Frontend | React 18 + TypeScript + Zustand + Vite |
| Desktop  | Tauri 2                                |
| Backend  | Rust (reqwest / tokio / futures)       |
| CI/CD    | GitHub Actions (windows-latest)        |
| i18n     | Chinese / English, runtime switching   |

## Usage

Download `tinypng-desktop.exe`, place it in any directory, and double-click to run.

`settings.json` is created automatically in the same directory. Delete the folder to fully uninstall — no registry entries.

## Development

### Prerequisites

```bash
# Install Rust (https://rustup.rs)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Install Node.js 18+ (https://nodejs.org)
```

### Run

```bash
npm install
npm run tauri dev
```

### Build

```bash
npm run tauri build -- --no-bundle
# Output: src-tauri/target/release/tinypng-desktop.exe
```

## Important Notes

- The **free API** is based on TinyPNG's web interface and may break at any time if the website changes. For reliable usage, consider an official API Key (500 free compressions/month).
- **Max 5MB per image** (TinyPNG limit). Oversized files are automatically skipped with a status bar notification.
- Avoid high concurrency or processing large batches in a short time to prevent IP rate limiting.
- Images are uploaded to TinyPNG servers for processing. Do not use with sensitive images.

## Changelog

See [CHANGELOG](./CHANGELOG.md)

## License

MIT
