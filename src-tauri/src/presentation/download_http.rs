use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::sync::Mutex;

use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use tokio::io::AsyncWriteExt;

use crate::application::AppState;
use crate::domain::ModelInfo;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DownloadProgress {
    pub total: u64,
    pub downloaded: u64,
    pub speed: f64,
}

pub fn register_cancel_token(
    dl_id: &str,
    cancel_tokens: &Mutex<HashMap<String, Arc<AtomicBool>>>,
) -> Arc<AtomicBool> {
    let flag = Arc::new(AtomicBool::new(false));
    let mut tokens = cancel_tokens.lock().unwrap();
    tokens.insert(dl_id.to_string(), flag.clone());
    flag
}

pub fn unregister_cancel_token(dl_id: &str, cancel_tokens: &Mutex<HashMap<String, Arc<AtomicBool>>>) {
    let mut tokens = cancel_tokens.lock().unwrap();
    tokens.remove(dl_id);
}

#[tauri::command]
pub async fn cancel_download(state: tauri::State<'_, AppState>, dl_id: String) -> Result<(), String> {
    let mut tokens = state.cancel_tokens.lock().unwrap();
    if let Some(flag) = tokens.remove(&dl_id) {
        flag.store(true, Ordering::Relaxed);
        crate::log_info!("[cancel_download] cancelled", "download", serde_json::json!({ "dl_id": &dl_id }));
        Ok(())
    } else {
        crate::log_warn!("[cancel_download] no active download found", "download", serde_json::json!({ "dl_id": &dl_id }));
        Err("No active download found for this ID".to_string())
    }
}

#[tauri::command]
pub async fn download_model(
    state: tauri::State<'_, AppState>,
    repo: String,
    file: String,
    dl_id: String,
    progress_tx: tauri::ipc::Channel<DownloadProgress>,
) -> Result<ModelInfo, String> {
    let _cancel = register_cancel_token(&dl_id, &state.cancel_tokens);
    let models_dir = {
        let config = state.config.read();
        PathBuf::from(&config.models_directory)
    };
    tokio::fs::create_dir_all(&models_dir)
        .await
        .map_err(|e| format!("Failed to create models directory: {}", e))?;

    let url = format!("https://huggingface.co/{}/resolve/main/{}", repo, file);
    let dest = models_dir.join(&file);

    let client = reqwest::Client::new();
    let response = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("Failed to start download: {}", e))?;

    let total_size = response.content_length().unwrap_or(0);
    let mut downloaded = 0u64;
    let mut file = tokio::fs::File::create(&dest)
        .await
        .map_err(|e| format!("Failed to create file: {}", e))?;

    let mut stream = response.bytes_stream();
    while let Some(chunk) = stream.next().await {
        if _cancel.load(Ordering::Relaxed) {
            let _ = tokio::fs::remove_file(&dest).await;
            return Err("Download cancelled".to_string());
        }

        let chunk = chunk.map_err(|e| format!("Download error: {}", e))?;
        file.write_all(&chunk)
            .await
            .map_err(|e| format!("Failed to write chunk: {}", e))?;

        downloaded += chunk.len() as u64;

        if progress_tx.send(DownloadProgress {
            total: total_size,
            downloaded,
            speed: 0.0,
        }).is_err() {
            crate::log_debug!("Download progress channel closed", "commands");
            break;
        }
    }

    file.flush().await.ok();
    unregister_cancel_token(&dl_id, &state.cancel_tokens);

    crate::presentation::model_detect::detect_model(&dest).await
}
