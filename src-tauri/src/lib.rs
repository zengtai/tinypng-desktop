use std::collections::HashMap;
use std::path::Path;
use std::sync::Arc;
use tokio::sync::Mutex;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager, Emitter};
use reqwest::multipart;
use base64::{Engine as _, engine::general_purpose};

// ── Types ──────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompressTask {
    pub id: String,
    pub file_path: String,
    pub file_name: String,
    pub file_size: u64,
    pub output_format: Option<String>, // "webp" | "avif" | "png" | "jpeg" | None (keep original)
    pub output_dir: Option<String>,
    pub suffix: Option<String>,        // e.g. "_tiny"
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskResult {
    pub id: String,
    pub status: String,        // "pending" | "uploading" | "converting" | "done" | "error"
    pub original_size: u64,
    pub compressed_size: Option<u64>,
    pub saved_percent: Option<f32>,
    pub output_path: Option<String>,
    pub error: Option<String>,
    pub output_format: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppSettings {
    pub output_dir: Option<String>,
    pub output_suffix: String,
    pub overwrite_original: bool,
    pub default_output_format: Option<String>,
    pub max_concurrent: usize,    // per-batch concurrency (1-5)
    pub retry_count: u32,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            output_dir: None,
            output_suffix: "_tiny".to_string(),
            overwrite_original: false,
            default_output_format: None,
            max_concurrent: 3,
            retry_count: 2,
        }
    }
}

// TinyPNG upload response
#[derive(Debug, Deserialize)]
struct TinyPngOutput {
    size: u64,
    #[serde(rename = "type")]
    mime_type: String,
    url: String,
    width: Option<u32>,
    height: Option<u32>,
}

#[derive(Debug, Deserialize)]
struct TinyPngResponse {
    output: TinyPngOutput,
}

// Convert request body
#[derive(Debug, Serialize)]
struct ConvertResize {
    #[serde(skip_serializing_if = "Option::is_none")]
    convert: Option<ConvertOptions>,
}

#[derive(Debug, Serialize)]
struct ConvertOptions {
    #[serde(rename = "type")]
    output_type: Vec<String>,
}

// ── State ──────────────────────────────────────────────────────────────────

pub struct AppState {
    pub settings: Mutex<AppSettings>,
    pub results: Mutex<HashMap<String, TaskResult>>,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            settings: Mutex::new(AppSettings::default()),
            results: Mutex::new(HashMap::new()),
        }
    }
}

// ── Core compression logic ─────────────────────────────────────────────────

async fn compress_single(
    app: &AppHandle,
    task: CompressTask,
    settings: AppSettings,
    client: &reqwest::Client,
) -> TaskResult {
    let id = task.id.clone();

    // Emit: uploading
    emit_status(app, &id, "uploading", None, None, None, None);

    // Read file
    let file_bytes = match tokio::fs::read(&task.file_path).await {
        Ok(b) => b,
        Err(e) => {
            let err = format!("读取文件失败: {e}");
            emit_status(app, &id, "error", None, None, None, Some(&err));
            return TaskResult {
                id,
                status: "error".into(),
                original_size: task.file_size,
                compressed_size: None,
                saved_percent: None,
                output_path: None,
                error: Some(err),
                output_format: task.output_format.clone(),
            };
        }
    };

    let file_name = task.file_name.clone();
    let mime = mime_guess::from_path(&task.file_path)
        .first_or_octet_stream()
        .to_string();

    // Upload to TinyPNG (simulating browser multipart upload)
    let part = multipart::Part::bytes(file_bytes.clone())
        .file_name(file_name.clone())
        .mime_str(&mime)
        .unwrap();

    let form = multipart::Form::new().part("input", part);

    let upload_result = client
        .post("https://tinypng.com/web/shrink")
        .header("Origin", "https://tinypng.com")
        .header("Referer", "https://tinypng.com/")
        .header("Accept", "application/json")
        .header("X-Requested-With", "XMLHttpRequest")
        .multipart(form)
        .send()
        .await;

    let response = match upload_result {
        Ok(r) => r,
        Err(e) => {
            let err = format!("上传失败: {e}");
            emit_status(app, &id, "error", None, None, None, Some(&err));
            return make_error_result(id, task.file_size, task.output_format, err);
        }
    };

    if !response.status().is_success() {
        let status_code = response.status().as_u16();
        let body = response.text().await.unwrap_or_default();
        let err = format!("TinyPNG 返回错误 {status_code}: {body}");
        emit_status(app, &id, "error", None, None, None, Some(&err));
        return make_error_result(id, task.file_size, task.output_format, err);
    }

    // Parse the Location header (TinyPNG returns compressed file URL in Location)
    let tiny_response: TinyPngResponse = match response.json().await {
        Ok(r) => r,
        Err(e) => {
            let err = format!("解析响应失败: {e}");
            emit_status(app, &id, "error", None, None, None, Some(&err));
            return make_error_result(id, task.file_size, task.output_format, err);
        }
    };

    let compressed_url = tiny_response.output.url.clone();
    let compressed_size_from_api = tiny_response.output.size;
    let api_output_format = tiny_response.output.mime_type.clone();

    // Determine actual output format
    let desired_format = task.output_format
        .clone()
        .or_else(|| settings.default_output_format.clone());

    // If format conversion needed, POST to the output URL with convert options
    let final_bytes: Vec<u8>;
    let final_format: String;
    let final_size: u64;

    if let Some(ref fmt) = desired_format {
        // Emit: converting
        emit_status(app, &id, "converting", Some(compressed_size_from_api), None, None, None);

        let convert_body = ConvertResize {
            convert: Some(ConvertOptions {
                output_type: vec![fmt.clone()],
            }),
        };

        let convert_resp = client
            .get(&compressed_url)
            .header("Origin", "https://tinypng.com")
            .header("Referer", "https://tinypng.com/")
            .json(&convert_body)
            .send()
            .await;

        // Actually TinyPNG convert uses a POST to same URL with JSON body
        let convert_resp = client
            .post(&compressed_url)
            .header("Origin", "https://tinypng.com")
            .header("Referer", "https://tinypng.com/")
            .header("Content-Type", "application/json")
            .json(&convert_body)
            .send()
            .await;

        match convert_resp {
            Ok(r) if r.status().is_success() => {
                // The response is the new output metadata
                let convert_meta: TinyPngResponse = match r.json().await {
                    Ok(m) => m,
                    Err(_) => {
                        // fallback: just download compressed without conversion
                        let bytes = download_bytes(client, &compressed_url).await
                            .unwrap_or_default();
                        final_bytes = bytes;
                        final_format = format_from_mime(&api_output_format);
                        final_size = final_bytes.len() as u64;
                        return save_result(app, task, settings, id, final_bytes, final_size, final_format).await;
                    }
                };
                let new_url = convert_meta.output.url;
                final_bytes = download_bytes(client, &new_url).await.unwrap_or_default();
                final_format = fmt.clone();
                final_size = final_bytes.len() as u64;
            }
            _ => {
                // Fallback: download without conversion
                final_bytes = download_bytes(client, &compressed_url).await.unwrap_or_default();
                final_format = format_from_mime(&api_output_format);
                final_size = final_bytes.len() as u64;
            }
        }
    } else {
        // No conversion, just download compressed file
        final_bytes = download_bytes(client, &compressed_url).await.unwrap_or_default();
        final_format = format_from_mime(&api_output_format);
        final_size = compressed_size_from_api;
    }

    save_result(app, task, settings, id, final_bytes, final_size, final_format).await
}

async fn save_result(
    app: &AppHandle,
    task: CompressTask,
    settings: AppSettings,
    id: String,
    bytes: Vec<u8>,
    compressed_size: u64,
    output_format: String,
) -> TaskResult {
    // Determine output path
    let input_path = Path::new(&task.file_path);
    let stem = input_path.file_stem().unwrap_or_default().to_string_lossy();

    let ext = match output_format.as_str() {
        "webp" => "webp",
        "avif" => "avif",
        "jpeg" | "jpg" => "jpg",
        _ => "png",
    };

    let out_filename = if settings.overwrite_original {
        task.file_name.clone()
    } else {
        let suffix = task.suffix.clone().unwrap_or(settings.output_suffix.clone());
        format!("{stem}{suffix}.{ext}")
    };

    let out_dir = task.output_dir
        .clone()
        .or_else(|| settings.output_dir.clone())
        .unwrap_or_else(|| {
            input_path.parent()
                .map(|p| p.to_string_lossy().to_string())
                .unwrap_or(".".to_string())
        });

    let out_path = Path::new(&out_dir).join(&out_filename);

    if let Err(e) = tokio::fs::create_dir_all(&out_dir).await {
        let err = format!("创建输出目录失败: {e}");
        emit_status(app, &id, "error", None, None, None, Some(&err));
        return make_error_result(id, task.file_size, Some(output_format), err);
    }

    if let Err(e) = tokio::fs::write(&out_path, &bytes).await {
        let err = format!("保存文件失败: {e}");
        emit_status(app, &id, "error", None, None, None, Some(&err));
        return make_error_result(id, task.file_size, Some(output_format), err);
    }

    let saved_pct = if task.file_size > 0 {
        let saved = (task.file_size as f32 - compressed_size as f32) / task.file_size as f32 * 100.0;
        Some(saved.max(0.0))
    } else {
        None
    };

    let out_path_str = out_path.to_string_lossy().to_string();

    emit_status(
        app, &id, "done",
        Some(compressed_size),
        saved_pct,
        Some(&out_path_str),
        None,
    );

    TaskResult {
        id,
        status: "done".into(),
        original_size: task.file_size,
        compressed_size: Some(compressed_size),
        saved_percent: saved_pct,
        output_path: Some(out_path_str),
        error: None,
        output_format: Some(output_format),
    }
}

async fn download_bytes(client: &reqwest::Client, url: &str) -> Result<Vec<u8>, String> {
    let resp = client.get(url)
        .header("Referer", "https://tinypng.com/")
        .send()
        .await
        .map_err(|e| e.to_string())?;
    resp.bytes().await.map(|b| b.to_vec()).map_err(|e| e.to_string())
}

fn format_from_mime(mime: &str) -> String {
    match mime {
        "image/webp" => "webp".to_string(),
        "image/avif" => "avif".to_string(),
        "image/jpeg" => "jpeg".to_string(),
        _ => "png".to_string(),
    }
}

fn make_error_result(id: String, original_size: u64, fmt: Option<String>, err: String) -> TaskResult {
    TaskResult {
        id,
        status: "error".into(),
        original_size,
        compressed_size: None,
        saved_percent: None,
        output_path: None,
        error: Some(err),
        output_format: fmt,
    }
}

fn emit_status(
    app: &AppHandle,
    id: &str,
    status: &str,
    compressed_size: Option<u64>,
    saved_percent: Option<f32>,
    output_path: Option<&str>,
    error: Option<&str>,
) {
    let payload = serde_json::json!({
        "id": id,
        "status": status,
        "compressed_size": compressed_size,
        "saved_percent": saved_percent,
        "output_path": output_path,
        "error": error,
    });
    let _ = app.emit("task-update", payload);
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

    // Build reqwest client with browser-like headers
    let client = reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36")
        .cookie_store(true)
        .timeout(std::time::Duration::from_secs(60))
        .build()
        .map_err(|e| e.to_string())?;

    let client = Arc::new(client);
    let settings = Arc::new(settings);

    // Initialize all tasks as pending
    {
        let mut results = state.results.lock().await;
        for task in &tasks {
            results.insert(task.id.clone(), TaskResult {
                id: task.id.clone(),
                status: "pending".into(),
                original_size: task.file_size,
                compressed_size: None,
                saved_percent: None,
                output_path: None,
                error: None,
                output_format: task.output_format.clone(),
            });
            emit_status(&app, &task.id, "pending", None, None, None, None);
        }
    }

    // Process in batches of 20 (TinyPNG limit), with max_concurrent inside each batch
    let batches: Vec<Vec<CompressTask>> = tasks
        .chunks(20)
        .map(|c| c.to_vec())
        .collect();

    let app_clone = app.clone();
    let state_results = Arc::new(Mutex::new(Vec::<TaskResult>::new()));

    tokio::spawn(async move {
        for batch in batches {
            use futures::stream::{self, StreamExt};

            let results: Vec<TaskResult> = stream::iter(batch)
                .map(|task| {
                    let app = app_clone.clone();
                    let client = client.clone();
                    let settings = settings.clone();
                    async move {
                        compress_single(&app, task, (*settings).clone(), &client).await
                    }
                })
                .buffer_unordered(max_concurrent)
                .collect()
                .await;

            let mut all = state_results.lock().await;
            all.extend(results);

            // Small delay between batches to be polite
            tokio::time::sleep(std::time::Duration::from_millis(500)).await;
        }

        // Emit all done
        let _ = app_clone.emit("all-done", ());
    });

    Ok(())
}

#[tauri::command]
pub async fn cancel_tasks(state: tauri::State<'_, AppState>) -> Result<(), String> {
    // In a full impl, you'd use a cancellation token
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
        .arg(std::path::Path::new(&path).parent().unwrap_or(std::path::Path::new("/")))
        .spawn()
        .map_err(|e| e.to_string())?;

    Ok(())
}

// ── App entry ──────────────────────────────────────────────────────────────

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
            cancel_tasks,
            open_folder,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
