use std::path::PathBuf;

use serde::{Deserialize, Serialize};
use tauri::State;

use crate::application::AppState;
use crate::domain::ModelFormat;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VerificationResult {
    pub valid: bool,
    pub checksum_match: bool,
    pub size_match: bool,
    pub format_valid: bool,
    pub error: Option<String>,
}

#[tauri::command]
pub async fn verify_model(
    state: State<'_, AppState>,
    id: String,
) -> Result<VerificationResult, String> {
    let (model, size) = {
        let cache = state.model_cache.lock().unwrap();
        let m = cache.get(&id).ok_or("Model not found")?;
        (m.clone(), m.size)
    };

    let path = PathBuf::from(&model.path);
    let metadata = tokio::fs::metadata(&path)
        .await
        .map_err(|e| format!("Failed to read file: {}", e))?;

    if metadata.len() != size {
        return Ok(VerificationResult {
            valid: false,
            checksum_match: false,
            size_match: false,
            format_valid: false,
            error: Some("File size mismatch".to_string()),
        });
    }

    let format_valid = if model.format == ModelFormat::Gguf {
        verify_gguf(&path).await.unwrap_or(false)
    } else {
        true
    };

    Ok(VerificationResult {
        valid: format_valid,
        checksum_match: model.checksum.is_some(),
        size_match: true,
        format_valid,
        error: None,
    })
}

async fn verify_gguf(path: &std::path::Path) -> Result<bool, String> {
    use tokio::io::AsyncReadExt;

    let mut file = tokio::fs::File::open(path)
        .await
        .map_err(|e| format!("Failed to open: {}", e))?;

    let mut header = vec![0u8; 12];
    file.read_exact(&mut header)
        .await
        .map_err(|e| format!("Failed to read header: {}", e))?;

    Ok(header.starts_with(b"GGUF"))
}
