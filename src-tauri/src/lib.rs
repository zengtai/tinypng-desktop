use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::future::Future;
use tokio::sync::Mutex;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};
use futures::stream::{self, StreamExt};

// ── Types ──────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompressTask {
    pub id: String,
    pub file_path: String,
    pub file_name: String,
    pub file_size: u64,
    pub formats: Vec<String>,
    pub output_dir: Option<String>,
    pub suffix: String,
    pub overwrite: bool,
    pub fmt_folder: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FmtResult {
    pub fmt: String,
    pub status: String,
    pub compressed_size: Option<u64>,
    pub saved_percent: Option<f32>,
    pub output_path: Option<String>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppSettings {
    pub output_dir: Option<String>,
    pub output_suffix: String,
    pub overwrite_original: bool,
    pub fmt_folder: bool,
    pub max_concurrent: usize,
    pub retry_count: u32,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            output_dir: None,
            output_suffix: "_tiny".to_string(),
            overwrite_original: false,
            fmt_folder: false,
            max_concurrent: 3,
            retry_count: 2,
        }
    }
}

#[derive(Debug, Deserialize)]
struct StoreResponse {
    key: String,
    size: u64,
}

#[derive(Debug, Deserialize)]
struct ProcessResponse {
    url: String,
    #[allow(dead_code)]
    size: u64,
    #[serde(rename = "type")]
    mime_type: String,
    width: Option<u32>,
    height: Option<u32>,
}

#[derive(Debug, Serialize)]
struct ProcessBody {
    key: String,
    #[serde(rename = "originalType")]
    original_type: String,
    #[serde(rename = "originalSize")]
    original_size: u64,
    convert: ConvertOptions,
}

#[derive(Debug, Serialize)]
struct ConvertOptions {
    #[serde(rename = "type")]
    mime_type: String,
}

// ── App State ──────────────────────────────────────────────────────────────

pub struct AppState {
    pub settings: Mutex<AppSettings>,
}

impl AppState {
    pub fn new() -> Self {
        Self { settings: Mutex::new(AppSettings::default()) }
    }
}

// ── Helpers ────────────────────────────────────────────────────────────────

fn build_client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36")
        .timeout(std::time::Duration::from_secs(60))
        .build()
        .map_err(|e| e.to_string())
}

fn base_headers() -> Vec<(&'static str, &'static str)> {
    vec![
        ("Origin", "https://tinypng.com"),
        ("Referer", "https://tinypng.com/"),
        ("Accept", "application/json"),
    ]
}

fn fmt_to_mime(fmt: &str) -> &'static str {
    match fmt {
        "webp" => "image/webp",
        "avif" => "image/avif",
        "jpeg" | "jpg" => "image/jpeg",
        "jxl" => "image/jxl",
        _ => "image/png",
    }
}

fn mime_to_ext(mime: &str) -> &'static str {
    match mime {
        "image/webp" => "webp",
        "image/avif" => "avif",
        "image/jpeg" => "jpg",
        "image/jxl" => "jxl",
        _ => "png",
    }
}

async fn with_retry<T, F, Fut>(retry_count: u32, op: F) -> Result<T, String>
where
    F: Fn() -> Fut,
    Fut: Future<Output = Result<T, String>>,
{
    let mut last_err = String::new();
    for attempt in 0..=retry_count {
        if attempt > 0 {
            tokio::time::sleep(std::time::Duration::from_millis(1500 * attempt as u64)).await;
        }
        match op().await {
            Ok(v) => return Ok(v),
            Err(e) => last_err = e,
        }
    }
    Err(last_err)
}

// ── HTTP operations ────────────────────────────────────────────────────────

async fn store_image(
    client: &reqwest::Client,
    image_bytes: Vec<u8>,
    content_type: &str,
) -> Result<StoreResponse, String> {
    let mut req = client
        .post("https://tinypng.com/backend/opt/store")
        .header("Content-Type", content_type);
    for (k, v) in base_headers() { req = req.header(k, v); }

    let resp = req.body(image_bytes).send().await
        .map_err(|e| format!("store request failed: {e}"))?;
    let status = resp.status();
    let body = resp.text().await.unwrap_or_default();
    if !status.is_success() {
        return Err(format!("store {status}: {}", &body[..body.len().min(200)]));
    }
    serde_json::from_str(&body).map_err(|e| format!("store parse error: {e}"))
}

async fn process_image(
    client: &reqwest::Client,
    key: &str,
    original_type: &str,
    original_size: u64,
    output_fmt: &str,
) -> Result<ProcessResponse, String> {
    let body = ProcessBody {
        key: key.to_string(),
        original_type: original_type.to_string(),
        original_size,
        convert: ConvertOptions { mime_type: fmt_to_mime(output_fmt).to_string() },
    };
    let mut req = client
        .post("https://tinypng.com/backend/opt/process")
        .header("Content-Type", "application/json");
    for (k, v) in base_headers() { req = req.header(k, v); }

    let resp = req.json(&body).send().await
        .map_err(|e| format!("process request failed: {e}"))?;
    let status = resp.status();
    let text = resp.text().await.unwrap_or_default();
    if !status.is_success() {
        return Err(format!("process {status}: {}", &text[..text.len().min(200)]));
    }
    serde_json::from_str(&text).map_err(|e| format!("process parse error: {e}"))
}

async fn download_image(client: &reqwest::Client, url: &str) -> Result<Vec<u8>, String> {
    let resp = client.get(url)
        .header("Referer", "https://tinypng.com/")
        .send().await
        .map_err(|e| format!("download failed: {e}"))?;
    if !resp.status().is_success() {
        return Err(format!("download status: {}", resp.status()));
    }
    resp.bytes().await.map(|b| b.to_vec())
        .map_err(|e| format!("download read failed: {e}"))
}

fn emit_fmt(app: &AppHandle, task_id: &str, result: &FmtResult) {
    let _ = app.emit("fmt-result", serde_json::json!({
        "task_id": task_id,
        "result": result,
    }));
}

fn make_result(fmt: &str, status: &str, err: Option<String>) -> FmtResult {
    FmtResult {
        fmt: fmt.to_string(),
        status: status.to_string(),
        compressed_size: None,
        saved_percent: None,
        output_path: None,
        error: err,
    }
}

fn resolve_suffix(suffix: &str, width: Option<u32>, height: Option<u32>) -> String {
    let s = suffix.replace("{w}", &width.map(|v| v.to_string()).unwrap_or_default());
    let s = s.replace("{h}", &height.map(|v| v.to_string()).unwrap_or_default());
    s
}

fn build_output_path(task: &CompressTask, ext: &str, fmt: &str, width: Option<u32>, height: Option<u32>) -> PathBuf {
    let input = Path::new(&task.file_path);
    let stem = input.file_stem().unwrap_or_default().to_string_lossy();
    let folder_name = if fmt == "jpeg" { "jpg" } else { fmt };
    let suffix = resolve_suffix(&task.suffix, width, height);
    let filename = if task.overwrite {
        format!("{stem}.{ext}")
    } else {
        format!("{stem}{suffix}.{ext}")
    };
    let base_dir: PathBuf = task.output_dir
        .as_deref()
        .map(PathBuf::from)
        .unwrap_or_else(|| input.parent().unwrap_or(Path::new(".")).to_path_buf());
    if task.fmt_folder {
        base_dir.join(folder_name).join(filename)
    } else {
        base_dir.join(filename)
    }
}

// ── Alpha channel detection ───────────────────────────────────────────────
// Lightweight check without decoding the full image.
// PNG: IHDR chunk color type (byte 25): 4=RGBA, 6=RGBA, 3=indexed(may have tRNS)
// WebP: check VP8L signature or ALPH chunk
// Other formats: assume no alpha

fn has_alpha_channel(bytes: &[u8], content_type: &str) -> bool {
    match content_type {
        "image/png" => {
            // PNG signature (8) + IHDR length (4) + "IHDR" (4) + width (4) + height (4) + bit_depth (1) + color_type (1)
            if bytes.len() < 26 { return false; }
            let color_type = bytes[25];
            // 4 = grayscale+alpha, 6 = RGBA, 3 = indexed (may have tRNS chunk)
            color_type == 4 || color_type == 6 || color_type == 3
        }
        "image/webp" => {
            // Look for "ALPH" chunk or VP8L (lossless always supports alpha)
            bytes.windows(4).any(|w| w == b"ALPH" || w == b"VP8L")
        }
        "image/avif" | "image/jxl" => true, // assume may have alpha
        _ => false,
    }
}

// ── Core task ──────────────────────────────────────────────────────────────

async fn compress_task(
    app: AppHandle,
    task: CompressTask,
    client: Arc<reqwest::Client>,
    retry_count: u32,
) {
    let image_bytes = match tokio::fs::read(&task.file_path).await {
        Ok(b) => b,
        Err(e) => {
            let err = format!("读取文件失败: {e}");
            for fmt in &task.formats {
                emit_fmt(&app, &task.id, &make_result(fmt, "error", Some(err.clone())));
            }
            return;
        }
    };

    let content_type = mime_guess::from_path(&task.file_path)
        .first_or_octet_stream()
        .to_string();

    // Detect alpha channel: PNG/WebP/AVIF may have transparency
    // JPEG does not support alpha — skip conversion and emit error immediately
    let has_alpha = has_alpha_channel(&image_bytes, &content_type);

    // Partition formats: skip jpeg/jpg if image has alpha
    let (skipped, formats_to_process): (Vec<_>, Vec<_>) = task.formats.iter()
        .partition(|fmt| has_alpha && (fmt.as_str() == "jpeg" || fmt.as_str() == "jpg"));

    for fmt in &skipped {
        emit_fmt(&app, &task.id, &make_result(
            fmt, "error",
            Some("原图含透明通道，不支持转换为 JPEG".to_string())
        ));
    }

    for fmt in &formats_to_process {
        emit_fmt(&app, &task.id, &make_result(fmt, "uploading", None));
    }

    if formats_to_process.is_empty() {
        return;
    }

    let store = match with_retry(retry_count, || {
        let client = client.clone();
        let bytes = image_bytes.clone();
        let ct = content_type.clone();
        async move { store_image(&client, bytes, &ct).await }
    }).await {
        Ok(s) => s,
        Err(e) => {
            for fmt in &formats_to_process {
                emit_fmt(&app, &task.id, &make_result(fmt, "error", Some(e.clone())));
            }
            return;
        }
    };

    for (i, fmt) in formats_to_process.iter().enumerate() {
        if i > 0 {
            tokio::time::sleep(std::time::Duration::from_millis(300)).await;
        }
        emit_fmt(&app, &task.id, &make_result(fmt, "processing", None));

        let proc = match with_retry(retry_count, || {
            let client = client.clone();
            let key = store.key.clone();
            let ct = content_type.clone();
            let size = store.size;
            let fmt = fmt.clone();
            async move { process_image(&client, &key, &ct, size, &fmt).await }
        }).await {
            Ok(p) => p,
            Err(e) => { emit_fmt(&app, &task.id, &make_result(fmt, "error", Some(e))); continue; }
        };

        let bytes = match download_image(&client, &proc.url).await {
            Ok(b) => b,
            Err(e) => { emit_fmt(&app, &task.id, &make_result(fmt, "error", Some(e))); continue; }
        };

        let ext = mime_to_ext(&proc.mime_type);
        let out_path = build_output_path(&task, ext, fmt, proc.width, proc.height);

        if let Some(parent) = out_path.parent() {
            if let Err(e) = tokio::fs::create_dir_all(parent).await {
                emit_fmt(&app, &task.id, &make_result(fmt, "error", Some(format!("创建目录失败: {e}"))));
                continue;
            }
        }

        if let Err(e) = tokio::fs::write(&out_path, &bytes).await {
            emit_fmt(&app, &task.id, &make_result(fmt, "error", Some(format!("保存文件失败: {e}"))));
            continue;
        }

        let compressed_size = bytes.len() as u64;
        let saved_pct = if task.file_size > 0 {
            ((task.file_size as f32 - compressed_size as f32) / task.file_size as f32 * 100.0).max(0.0)
        } else { 0.0 };

        emit_fmt(&app, &task.id, &FmtResult {
            fmt: fmt.to_string(),
            status: "done".into(),
            compressed_size: Some(compressed_size),
            saved_percent: Some(saved_pct),
            output_path: Some(out_path.to_string_lossy().to_string()),
            error: None,
        });
    }
}

// ── Config path helper ────────────────────────────────────────────────────

fn config_path() -> Result<std::path::PathBuf, String> {
    let exe = std::env::current_exe().map_err(|e| e.to_string())?;
    let dir = exe.parent().ok_or_else(|| "Cannot get exe directory".to_string())?;
    Ok(dir.join("settings.json"))
}

// ── Commands (in submodule to avoid generate_handler! namespace conflict) ──

mod commands {
    use super::*;

    #[tauri::command]
    pub async fn get_settings(state: tauri::State<'_, AppState>) -> Result<AppSettings, String> {
        Ok(state.settings.lock().await.clone())
    }

    #[tauri::command]
    pub async fn save_settings(
        state: tauri::State<'_, AppState>,
        settings: AppSettings,
    ) -> Result<(), String> {
        *state.settings.lock().await = settings;
        Ok(())
    }

    #[tauri::command]
    pub async fn compress_images(
        app: AppHandle,
        state: tauri::State<'_, AppState>,
        tasks: Vec<CompressTask>,
    ) -> Result<(), String> {
        let settings = state.settings.lock().await.clone();
        let max_concurrent = settings.max_concurrent.clamp(1, 5);
        let client = Arc::new(build_client()?);
        let retry = settings.retry_count;

        let batches: Vec<Vec<CompressTask>> = tasks.chunks(20).map(|c| c.to_vec()).collect();

        tokio::spawn(async move {
            for (i, batch) in batches.iter().enumerate() {
                stream::iter(batch.clone())
                    .map(|task| {
                        let app = app.clone();
                        let client = client.clone();
                        async move { compress_task(app, task, client, retry).await }
                    })
                    .buffer_unordered(max_concurrent)
                    .collect::<Vec<_>>()
                    .await;

                if i < batches.len() - 1 {
                    tokio::time::sleep(std::time::Duration::from_millis(600)).await;
                }
            }
            let _ = app.emit("all-done", ());
        });

        Ok(())
    }

    #[tauri::command]
    pub fn load_settings_file() -> Result<String, String> {
        let path = config_path()?;
        if !path.exists() {
            return Ok(String::new());
        }
        std::fs::read_to_string(&path).map_err(|e| e.to_string())
    }

    #[tauri::command]
    pub fn save_settings_file(content: String) -> Result<(), String> {
        let path = config_path()?;
        std::fs::write(&path, content).map_err(|e| e.to_string())
    }

    #[tauri::command]
    pub fn clear_settings_file() -> Result<(), String> {
        let path = config_path()?;
        if path.exists() {
            std::fs::remove_file(&path).map_err(|e| e.to_string())?;
        }
        Ok(())
    }

    #[tauri::command]
    pub async fn open_folder(path: String) -> Result<(), String> {
        #[cfg(target_os = "macos")]
        std::process::Command::new("open")
            .args(["-R", &path])
            .spawn()
            .map_err(|e| e.to_string())?;

        #[cfg(target_os = "windows")]
        std::process::Command::new("explorer")
            .args(["/select,", &path])
            .spawn()
            .map_err(|e| e.to_string())?;

        #[cfg(target_os = "linux")]
        std::process::Command::new("xdg-open")
            .arg(Path::new(&path).parent().unwrap_or(Path::new("/")))
            .spawn()
            .map_err(|e| e.to_string())?;

        Ok(())
    }
}

// ── Entry point ────────────────────────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(AppState::new())
        .invoke_handler(tauri::generate_handler![
            commands::get_settings,
            commands::save_settings,
            commands::compress_images,
            commands::open_folder,
            commands::load_settings_file,
            commands::save_settings_file,
            commands::clear_settings_file,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
