use std::path::PathBuf;

use tauri::AppHandle;
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_opener::OpenerExt;

use crate::application::AppState;
use crate::presentation::model_detect::detect_model;
use crate::domain::ModelInfo;

#[tauri::command]
pub async fn scan_models(state: tauri::State<'_, AppState>) -> Result<Vec<ModelInfo>, String> {
    let models_dir = {
        let config = state.config.read();
        PathBuf::from(&config.models_directory)
    };

    if !models_dir.exists() {
        return Ok(Vec::new());
    }

    let mut models = Vec::new();
    let mut entries = tokio::fs::read_dir(&models_dir)
        .await
        .map_err(|e| format!("Failed to read models directory: {}", e))?;

    while let Some(entry) = entries
        .next_entry()
        .await
        .map_err(|e| format!("Failed to read directory entry: {}", e))?
    {
        let path = entry.path();

        if path.is_file() {
            if let Some(ext) = path.extension() {
                let ext = ext.to_string_lossy().to_lowercase();
                if matches!(ext.as_str(), "gguf" | "ggml" | "bin" | "safetensors" | "pt" | "onnx")
                {
                    if let Ok(model) = detect_model(&path).await {
                        models.push(model);
                    }
                }
            }
        }
    }

    let mut cache = state.model_cache.lock().unwrap();
    for model in &models {
        cache.insert(model.id.clone(), model.clone());
    }

    Ok(models)
}

#[tauri::command]
pub async fn get_model_info(state: tauri::State<'_, AppState>, id: String) -> Result<Option<ModelInfo>, String> {
    let cache = state.model_cache.lock().unwrap();
    Ok(cache.get(&id).cloned())
}

#[tauri::command]
pub async fn delete_model(state: tauri::State<'_, AppState>, id: String) -> Result<(), String> {
    
    
    let model = {
        let cache = state.model_cache.lock().unwrap();
        cache.get(&id).cloned().ok_or("Model not found")?
    };

    let path = PathBuf::from(&model.path);
    if path.exists() {
        tokio::fs::remove_file(&path)
            .await
            .map_err(|e| format!("Failed to delete model: {}", e))?;
    }

    state.model_cache.lock().unwrap().remove(&id);

    Ok(())
}

#[tauri::command]
pub async fn open_model_folder(state: tauri::State<'_, AppState>, app: AppHandle) -> Result<(), String> {
    let config = state.config.read();
    let path = PathBuf::from(&config.models_directory);

    if path.exists() {
        app.opener()
            .open_path(path.to_string_lossy().to_string(), None::<&str>)
            .map_err(|e| format!("Failed to open folder: {}", e))
    } else {
        Err("Models directory does not exist".to_string())
    }
}

#[tauri::command]
pub async fn select_model_file(app: AppHandle) -> Result<Option<String>, String> {
    let result = app
        .dialog()
        .file()
        .add_filter("Model Files", &["gguf", "ggml", "bin", "safetensors", "pt", "onnx"])
        .blocking_pick_file();

    Ok(result.map(|p| p.to_string()))
}

#[tauri::command]
pub async fn select_model_files(app: AppHandle) -> Result<Vec<String>, String> {
    let result = app
        .dialog()
        .file()
        .add_filter("Model Files", &["gguf", "ggml", "bin", "safetensors", "pt", "onnx"])
        .blocking_pick_files();

    Ok(result.unwrap_or_default().into_iter().map(|p| match p {
        tauri_plugin_dialog::FilePath::Path(path) => path.to_string_lossy().to_string(),
        tauri_plugin_dialog::FilePath::Url(url) => url.to_string(),
    }).collect())
}

#[tauri::command]
pub async fn serve_model_file(path: String) -> Result<String, String> {
    Ok(format!(
        "llama-launcher://model/{}",
        urlencoding::encode(&path)
    ))
}

#[tauri::command]
pub async fn serve_asset_file(path: String) -> Result<String, String> {
    Ok(format!(
        "llama-launcher://asset/{}",
        urlencoding::encode(&path)
    ))
}
