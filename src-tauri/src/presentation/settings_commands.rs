use std::path::Path;

use tauri::AppHandle;
use tauri_plugin_store::StoreExt;

use crate::application::AppState;
use crate::AppConfig;

#[tauri::command]
pub async fn get_config(state: tauri::State<'_, AppState>) -> Result<AppConfig, String> {
    let config = state.config.read();
    Ok(config.clone())
}

#[tauri::command]
pub async fn update_config(state: tauri::State<'_, AppState>, config: AppConfig, app: AppHandle) -> Result<(), String> {
    if let Some(ref llama_path) = config.llama_binary_path {
        if !Path::new(llama_path).exists() {
            return Err("llama_binary_path does not exist".to_string());
        }
    }

    if !Path::new(&config.models_directory).exists() {
        tokio::fs::create_dir_all(&config.models_directory)
            .await
            .map_err(|e| format!("Failed to create models directory: {}", e))?;
    }

    *state.config.write() = config.clone();

    if let Ok(store) = app.store("config.json") {
        store.set("config", serde_json::to_value(&config).unwrap());
        let _ = store.save();
    }

    Ok(())
}

#[tauri::command]
pub async fn select_directory(app: tauri::AppHandle) -> Result<Option<String>, String> {
    use tauri_plugin_dialog::DialogExt;
    let path = app.dialog()
        .file()
        .blocking_pick_folder();
    Ok(path.map(|p| match p {
        tauri_plugin_dialog::FilePath::Path(path) => path.as_path().to_string_lossy().to_string(),
        tauri_plugin_dialog::FilePath::Url(url) => url.to_string(),
    }))
}

#[tauri::command]
pub async fn ensure_app_dir() -> Result<String, String> {
    let dir = if cfg!(windows) {
        let profile = std::env::var("USERPROFILE").map_err(|_| "USERPROFILE not set".to_string())?;
        std::path::PathBuf::from(profile).join(".llama-launcher")
    } else {
        let home = std::env::var("HOME").map_err(|_| "HOME not set".to_string())?;
        std::path::PathBuf::from(home).join(".llama-launcher")
    };
    tokio::fs::create_dir_all(&dir).await.map_err(|e| format!("Failed to create app dir: {}", e))?;
    Ok(dir.to_string_lossy().replace('\\', "/"))
}
