use std::sync::atomic::Ordering;

use futures_util::StreamExt;
use tokio::io::AsyncWriteExt;

use crate::application::AppState;
use super::download_http::{DownloadProgress, register_cancel_token, unregister_cancel_token};

#[tauri::command]
pub async fn download_file(
    state: tauri::State<'_, AppState>,
    url: String,
    dest: String,
    dl_id: String,
    progress_tx: tauri::ipc::Channel<DownloadProgress>,
) -> Result<String, String> {
    let cancel = register_cancel_token(&dl_id, &state.cancel_tokens);

    crate::log_info!("[download_file] starting", "download", serde_json::json!({ "url": &url, "dest": &dest, "dl_id": &dl_id }));

    let expanded_dest = if dest.starts_with("~/") || dest.starts_with("~\\") {
        let home = if cfg!(windows) {
            std::env::var("USERPROFILE").ok()
        } else {
            std::env::var("HOME").ok()
        };
        let home = home.ok_or_else(|| {
            unregister_cancel_token(&dl_id, &state.cancel_tokens);
            crate::log_error!("[download_file] cannot determine home directory", "download", serde_json::json!({ "dl_id": &dl_id }));
            "Could not determine home directory".to_string()
        })?;
        let rest = &dest[2..];
        std::path::PathBuf::from(&home).join(rest).to_string_lossy().to_string()
    } else {
        dest.clone()
    };

    let dest_path = std::path::PathBuf::from(&expanded_dest);
    if let Some(parent) = dest_path.parent() {
        tokio::fs::create_dir_all(parent).await.map_err(|e| {
            unregister_cancel_token(&dl_id, &state.cancel_tokens);
            crate::log_error!("[download_file] failed to create directory", "download", serde_json::json!({ "path": parent.to_string_lossy().to_string(), "error": e.to_string() }));
            format!("Failed to create directory: {}", e)
        })?;
    }

    let client = reqwest::Client::builder()
        .user_agent("llama-launcher")
        .build()
        .map_err(|e| {
            unregister_cancel_token(&dl_id, &state.cancel_tokens);
            crate::log_error!("[download_file] failed to create HTTP client", "download", serde_json::json!({ "error": e.to_string() }));
            format!("Failed to create HTTP client: {}", e)
        })?;

    let response = client.get(&url).send().await.map_err(|e| {
        unregister_cancel_token(&dl_id, &state.cancel_tokens);
        crate::log_error!("[download_file] failed to start download", "download", serde_json::json!({ "url": &url, "error": e.to_string() }));
        format!("Failed to start download: {}", e)
    })?;

    let status = response.status();
    if !status.is_success() {
        unregister_cancel_token(&dl_id, &state.cancel_tokens);
        let msg = format!("HTTP {}: {}", status.as_u16(), status.canonical_reason().unwrap_or("Unknown"));
        crate::log_error!("[download_file] non-success HTTP status", "download", serde_json::json!({ "url": &url, "status": status.as_u16(), "error": &msg }));
        return Err(msg);
    }

    let content_type = response.headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");
    if content_type.contains("text/html") {
        unregister_cancel_token(&dl_id, &state.cancel_tokens);
        crate::log_error!("[download_file] server returned HTML instead of binary", "download", serde_json::json!({ "url": &url, "content_type": &content_type }));
        return Err("Server returned HTML (likely an error page) instead of a binary file".to_string());
    }

    let total_size = response.content_length().unwrap_or(0);

    if total_size > 0 && total_size < 1_000_000 {
        unregister_cancel_token(&dl_id, &state.cancel_tokens);
        crate::log_error!("[download_file] file too small", "download", serde_json::json!({ "url": &url, "total_size": total_size }));
        return Err(format!("File too small ({} bytes) - likely an error page", total_size));
    }

    crate::log_info!("[download_file] accepted", "download", serde_json::json!({ "total_size": total_size, "dest": &expanded_dest }));

    let mut downloaded = 0u64;
    let mut file = tokio::fs::File::create(&dest_path).await.map_err(|e| {
        unregister_cancel_token(&dl_id, &state.cancel_tokens);
        crate::log_error!("[download_file] failed to create file", "download", serde_json::json!({ "path": &expanded_dest, "error": e.to_string() }));
        format!("Failed to create file {}: {}", expanded_dest, e)
    })?;

    let mut stream = response.bytes_stream();
    let mut last_update = tokio::time::Instant::now();
    let mut last_bytes = 0u64;

    while let Some(chunk) = stream.next().await {
        if cancel.load(Ordering::Relaxed) {
            let _ = tokio::fs::remove_file(&dest_path).await;
            unregister_cancel_token(&dl_id, &state.cancel_tokens);
            crate::log_warn!("[download_file] cancelled by user", "download", serde_json::json!({ "dl_id": &dl_id, "downloaded": downloaded }));
            return Err("Download cancelled".to_string());
        }

        let chunk = chunk.map_err(|e| {
            crate::log_error!("[download_file] stream error", "download", serde_json::json!({ "error": e.to_string(), "downloaded": downloaded }));
            format!("Download error: {}", e)
        })?;

        file.write_all(&chunk).await.map_err(|e| {
            crate::log_error!("[download_file] write error", "download", serde_json::json!({ "error": e.to_string(), "downloaded": downloaded }));
            format!("Failed to write chunk: {}", e)
        })?;

        downloaded += chunk.len() as u64;

        if last_update.elapsed() >= std::time::Duration::from_millis(500) {
            let speed = (downloaded - last_bytes) as f64 / last_update.elapsed().as_secs_f64();
            last_update = tokio::time::Instant::now();
            last_bytes = downloaded;

            if progress_tx.send(DownloadProgress {
                total: total_size,
                downloaded,
                speed,
            }).is_err() {
                crate::log_debug!("[download_file] progress channel closed", "download");
                break;
            }
        }
    }

    file.flush().await.ok();
    unregister_cancel_token(&dl_id, &state.cancel_tokens);

    if total_size > 0 {
        let metadata = tokio::fs::metadata(&dest_path).await.map_err(|e| {
            crate::log_error!("[download_file] failed to stat downloaded file", "download", serde_json::json!({ "path": &expanded_dest, "error": e.to_string() }));
            format!("Failed to stat downloaded file: {}", e)
        })?;
        if metadata.len() < 1_000_000 {
            let _ = tokio::fs::remove_file(&dest_path).await;
            crate::log_error!("[download_file] downloaded file too small", "download", serde_json::json!({ "path": &expanded_dest, "size": metadata.len() }));
            return Err(format!("Downloaded file too small ({} bytes) - likely an error page", metadata.len()));
        }
    }

    crate::log_info!("[download_file] completed", "download", serde_json::json!({ "path": &expanded_dest, "size": downloaded }));
    Ok(expanded_dest.replace('\\', "/"))
}
