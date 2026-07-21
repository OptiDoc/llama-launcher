use serde::{Deserialize, Serialize};

use crate::application::AppState;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExternalModelFile {
    pub id: String,
    pub filename: String,
    pub path: String,
    pub size_mb: f64,
    pub format: String,
    pub estimated_parameters: Option<String>,
    pub quantization: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExternalModelDir {
    pub id: String,
    pub source: String,
    pub display_name: String,
    pub path: String,
    pub model_count: usize,
    pub total_size_mb: f64,
    pub enabled: bool,
    pub files: Vec<ExternalModelFile>,
}

#[tauri::command]
pub async fn sync_external_models(
    state: tauri::State<'_, AppState>,
    dirs: Vec<ExternalModelDir>,
) -> Result<usize, String> {
    let models_dir = {
        let config = state.config.read();
        std::path::PathBuf::from(&config.models_directory)
    };
    tokio::fs::create_dir_all(&models_dir).await.map_err(|e| format!("Failed to create models dir: {}", e))?;

    let mut imported = 0;

    for dir in dirs {
        if !dir.enabled {
            continue;
        }

        for file in dir.files {
            let src = std::path::Path::new(&file.path);
            let dest = models_dir.join(&file.filename);

            if dest.exists() {
                continue;
            }

            if let Err(e) = tokio::fs::copy(src, &dest).await {
                crate::log_error!("[sync_external_models] Failed to copy", "sync", serde_json::json!({ "filename": &file.filename, "error": e.to_string() }));
                continue;
            }

            imported += 1;
            crate::log_info!("[sync_external_models] Imported", "sync", serde_json::json!({ "filename": &file.filename }));
        }
    }

    Ok(imported)
}

#[tauri::command]
pub async fn import_external_model(file_path: String, dest_dir: String) -> Result<String, String> {
    let src = std::path::Path::new(&file_path);
    let dest_dir = std::path::Path::new(&dest_dir);

    tokio::fs::create_dir_all(dest_dir).await.map_err(|e| format!("Failed to create dest dir: {}", e))?;

    let filename = src.file_name()
        .and_then(|n| n.to_str())
        .ok_or("Invalid filename")?;

    let dest = dest_dir.join(filename);

    tokio::fs::copy(src, &dest).await.map_err(|e| format!("Failed to copy: {}", e))?;

    Ok(dest.to_string_lossy().replace('\\', "/"))
}

#[tauri::command]
pub async fn import_model_files(
    file_paths: Vec<String>,
    dest_dir: String,
    move_files: bool,
) -> Result<Vec<String>, String> {
    let dest_dir = std::path::Path::new(&dest_dir);
    tokio::fs::create_dir_all(dest_dir).await.map_err(|e| format!("Failed to create dest dir: {}", e))?;

    let mut imported = Vec::new();

    for file_path in file_paths {
        let src = std::path::Path::new(&file_path);
        let filename = src.file_name()
            .and_then(|n| n.to_str())
            .ok_or("Invalid filename")?;

        let dest = dest_dir.join(filename);

        if move_files {
            tokio::fs::rename(src, &dest).await.map_err(|e| format!("Failed to move {}: {}", filename, e))?;
        } else {
            tokio::fs::copy(src, &dest).await.map_err(|e| format!("Failed to copy {}: {}", filename, e))?;
        }

        imported.push(dest.to_string_lossy().replace('\\', "/"));
        crate::log_info!("[import_model_files] Imported {}", filename);
    }

    Ok(imported)
}
