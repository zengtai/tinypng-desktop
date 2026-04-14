use std::path::Path;
use std::sync::Arc;
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
    pub formats: Vec<String>, // ["webp", "png", "avif"] etc.
    pub output_dir: Option<String>,
    pub suffix: String,
    pub overwrite: bool,
    pub fmt_folder: bool, // save into per-format subfolders
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FmtResult {
    pub fmt: String,
    pub status: String, // "uploading" | "processing" | "done" | "error"
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

// TinyPNG store response
#[derive(Debug, Deserialize)]
struct StoreResponse {
    key: String,
    size: u64,
}

// TinyPNG process response
#[derive(Debug, Deserialize)]
struct ProcessResponse {
    url: String,
    size: u64,
    #[serde(rename = "type")]
    mime_type: String,
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
        Self {
            settings: Mutex::new(AppSettings::default()),
        }
    }
}

// ── HTTP helpers ───────────────────────────────────────────────────────────

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

// ── Core compression ───────────────────────────────────────────────────────

async fn store_image(
    client: &reqwest::Client,
    image_bytes: Vec<u8>,
    content_type: &str,
) -> Result<StoreResponse, String> {
    let mut req = client
        .post("https://tinypng.com/backend/opt/store")
        .header("Content-Type", content_type);

    for (k, v) in base_headers() {
        req = req.header(k, v);
    }

    let resp = req
        .body(image_bytes)
        .send()
        .await
        .map_err(|e| format!("store request failed: {e}"))?;

    let status = resp.status();
    let body = resp.text().await.unwrap_or_default();

    if !status.is_success() {
        return Err(format!("store {status}: {}", &body[..body.len().min(200)]));
    }

    serde_json::from_str(&body).map_err(|e| format!("store parse error: {e} body={body}"))
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
        convert: ConvertOptions {
            mime_type: fmt_to_mime(output_fmt).to_string(),
        },
    };

    let mut req = client
        .post("https://tinypng.com/backend/opt/process")
        .header("Content-Type", "application/json");

    for (k, v) in base_headers() {
        req = req.header(k, v);
    }

    let resp = req
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("process request failed: {e}"))?;

    let status = resp.status();
    let text = resp.text().await.unwrap_or_default();

    if !status.is_success() {
        return Err(format!("process {status}: {}", &text[..text.len().min(200)]));
    }

    serde_json::from_str(&text).map_err(|e| format!("process parse error: {e} body={text}"))
}

async fn download_image(
    client: &reqwest::Client,
    url: &str,
) -> Result<Vec<u8>, String> {
    let resp = client
        .get(url)
        .header("Referer", "https://tinypng.com/")
        .send()
        .await
        .map_err(|e| format!("download failed: {e}"))?;

    if !resp.status().is_success() {
        return Err(format!("download status: {}", resp.status()));
    }

    resp.bytes()
        .await
        .map(|b| b.to_vec())
        .map_err(|e| format!("download read failed: {e}"))
}

fn emit_fmt_result(app: &AppHandle, task_id: &str, result: &FmtResult) {
    let _ = app.emit("fmt-result", serde_json::json!({
        "task_id": task_id,
        "result": result,
    }));
}

async fn compress_task(
    app: AppHandle,
    task: CompressTask,
    client: Arc<reqwest::Client>,
    retry_count: u32,
) {
    // Read file
    let image_bytes = match tokio::fs::read(&task.file_path).await {
        Ok(b) => b,
        Err(e) => {
            let err = format!("读取文件失败: {e}");
            for fmt in &task.formats {
                emit_fmt_result(&app, &task.id, &FmtResult {
                    fmt: fmt.clone(),
                    status: "error".into(),
                    compressed_size: None,
                    saved_percent: None,
                    output_path: None,
                    error: Some(err.clone()),
                });
            }
            return;
        }
    };

    let content_type = mime_guess::from_path(&task.file_path)
        .first_or_octet_stream()
        .to_string();

    // Mark all formats as uploading
    for fmt in &task.formats {
        emit_fmt_result(&app, &task.id, &FmtResult {
            fmt: fmt.clone(),
            status: "uploading".into(),
            compressed_size: None,
            saved_percent: None,
            output_path: None,
            error: None,
        });
    }

    // Step 1: store once
    let store_result = {
        let mut last_err = String::new();
        let mut result = None;
        for attempt in 0..=retry_count {
            if attempt > 0 {
                tokio::time::sleep(std::time::Duration::from_millis(1500 * attempt as u64)).await;
            }
            match store_image(&client, image_bytes.clone(), &content_type).await {
                Ok(r) => { result = Some(r); break; }
                Err(e) => { last_err = e; }
            }
        }
        result.ok_or(last_err)
    };

    let store = match store_result {
        Ok(s) => s,
        Err(e) => {
            for fmt in &task.formats {
                emit_fmt_result(&app, &task.id, &FmtResult {
                    fmt: fmt.clone(),
                    status: "error".into(),
                    compressed_size: None,
                    saved_percent: None,
                    output_path: None,
                    error: Some(e.clone()),
                });
            }
            return;
        }
    };

    // Step 2: process + download each format serially
    for (i, fmt) in task.formats.iter().enumerate() {
        if i > 0 {
            tokio::time::sleep(std::time::Duration::from_millis(300)).await;
        }

        // Mark as processing
        emit_fmt_result(&app, &task.id, &FmtResult {
            fmt: fmt.clone(),
            status: "processing".into(),
            compressed_size: None,
            saved_percent: None,
            output_path: None,
            error: None,
        });

        // Process with retry
        let process_result = {
            let mut last_err = String::new();
            let mut result = None;
            for attempt in 0..=retry_count {
                if attempt > 0 {
                    tokio::time::sleep(std::time::Duration::from_millis(1500 * attempt as u64)).await;
                }
                match process_image(&client, &store.key, &content_type, store.size, fmt).await {
                    Ok(r) => { result = Some(r); break; }
                    Err(e) => { last_err = e; }
                }
            }
            result.ok_or(last_err)
        };

        let proc = match process_result {
            Ok(p) => p,
            Err(e) => {
                emit_fmt_result(&app, &task.id, &FmtResult {
                    fmt: fmt.clone(),
                    status: "error".into(),
                    compressed_size: None,
                    saved_percent: None,
                    output_path: None,
                    error: Some(e),
                });
                continue;
            }
        };

        // Download
        let bytes = match download_image(&client, &proc.url).await {
            Ok(b) => b,
            Err(e) => {
                emit_fmt_result(&app, &task.id, &FmtResult {
                    fmt: fmt.clone(),
                    status: "error".into(),
                    compressed_size: None,
                    saved_percent: None,
                    output_path: None,
                    error: Some(e),
                });
                continue;
            }
        };

        // Build output path
        let ext = mime_to_ext(&proc.mime_type);
        let input_path = Path::new(&task.file_path);
        let stem = input_path.file_stem().unwrap_or_default().to_string_lossy();
        let filename = if task.overwrite {
            format!("{stem}.{ext}")
        } else {
            format!("{stem}{}.{ext}", task.suffix)
        };

        let base_dir = task.output_dir.clone().unwrap_or_else(|| {
            input_path.parent()
                .map(|p| p.to_string_lossy().to_string())
                .unwrap_or_else(|| ".".to_string())
        });

        let out_dir = if task.fmt_folder {
            format!("{base_dir}/{fmt}")
        } else {
            base_dir
        };

        let out_path = Path::new(&out_dir).join(&filename);

        if let Err(e) = tokio::fs::create_dir_all(&out_dir).await {
            emit_fmt_result(&app, &task.id, &FmtResult {
                fmt: fmt.clone(),
                status: "error".into(),
                compressed_size: None,
                saved_percent: None,
                output_path: None,
                error: Some(format!("创建目录失败: {e}")),
            });
            continue;
        }

        if let Err(e) = tokio::fs::write(&out_path, &bytes).await {
            emit_fmt_result(&app, &task.id, &FmtResult {
                fmt: fmt.clone(),
                status: "error".into(),
                compressed_size: None,
                saved_percent: None,
                output_path: None,
                error: Some(format!("保存文件失败: {e}")),
            });
            continue;
        }

        let compressed_size = bytes.len() as u64;
        let saved_pct = if task.file_size > 0 {
            ((task.file_size as f32 - compressed_size as f32) / task.file_size as f32 * 100.0).max(0.0)
        } else {
            0.0
        };

        emit_fmt_result(&app, &task.id, &FmtResult {
            fmt: fmt.clone(),
            status: "done".into(),
            compressed_size: Some(compressed_size),
            saved_percent: Some(saved_pct),
            output_path: Some(out_path.to_string_lossy().to_string()),
            error: None,
        });
    }
}

// ── Tauri commands ─────────────────────────────────────────────────────────

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

    // Batch into groups of 20, process with concurrency within each batch
    let batches: Vec<Vec<CompressTask>> = tasks.chunks(20).map(|c| c.to_vec()).collect();

    tokio::spawn(async move {
        for (i, batch) in batches.iter().enumerate() {
            stream::iter(batch.clone())
                .map(|task| {
                    let app = app.clone();
                    let client = client.clone();
                    async move {
                        compress_task(app, task, client, retry).await;
                    }
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

// ── Entry point ────────────────────────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .manage(AppState::new())
        .invoke_handler(tauri::generate_handler![
            get_settings,
            save_settings,
            compress_images,
            open_folder,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}