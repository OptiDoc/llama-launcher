use std::sync::atomic::Ordering;

use crate::application::AppState;
use crate::presentation::download_http;

#[tauri::command]
pub async fn extract_zip(
    state: tauri::State<'_, AppState>,
    zip_path: String,
    dest_dir: String,
    dl_id: String,
    progress_tx: tauri::ipc::Channel<download_http::DownloadProgress>,
) -> Result<String, String> {
    let _cancel = download_http::register_cancel_token(&dl_id, &state.cancel_tokens);
    tokio::fs::create_dir_all(&dest_dir).await.map_err(|e| {
        download_http::unregister_cancel_token(&dl_id, &state.cancel_tokens);
        crate::log_error!(&format!("extract_zip: failed to create directory {}: {}", dest_dir, e), "download");
        format!("Failed to create extract directory: {}", e)
    })?;

    let file = std::fs::File::open(&zip_path).map_err(|e| {
        download_http::unregister_cancel_token(&dl_id, &state.cancel_tokens);
        crate::log_error!(&format!("extract_zip: failed to open zip {}: {}", zip_path, e), "download");
        format!("Failed to open zip file: {}", e)
    })?;

    let mut archive = zip::ZipArchive::new(file).map_err(|e| {
        download_http::unregister_cancel_token(&dl_id, &state.cancel_tokens);
        crate::log_error!(&format!("extract_zip: failed to read archive {}: {}", zip_path, e), "download");
        format!("Failed to read zip archive: {}", e)
    })?;

    let total = archive.len() as u64;
    crate::log_info!(&format!("extract_zip: extracting {} entries from {} to {}", total, zip_path, dest_dir), "download");

    for i in 0..archive.len() {
        if download_http::register_cancel_token(&dl_id, &state.cancel_tokens).load(Ordering::Relaxed) {
        download_http::unregister_cancel_token(&dl_id, &state.cancel_tokens);
            crate::log_warn!("extract_zip: cancelled by user", "download");
            return Err("Extraction cancelled".to_string());
        }

        let mut entry = archive.by_index(i).map_err(|e| {
            crate::log_error!(&format!("extract_zip: failed to read entry {}: {}", i, e), "download");
            format!("Failed to read zip entry {}: {}", i, e)
        })?;

        let out_path = std::path::Path::new(&dest_dir).join(entry.name());
        if entry.is_dir() {
            std::fs::create_dir_all(&out_path).ok();
        } else {
            if let Some(parent) = out_path.parent() {
                std::fs::create_dir_all(parent).ok();
            }
            let mut outfile = std::fs::File::create(&out_path).map_err(|e| {
                crate::log_error!(&format!("extract_zip: failed to create file {:?}: {}", out_path, e), "download");
                format!("Failed to create file {:?}: {}", out_path, e)
            })?;
            std::io::copy(&mut entry, &mut outfile).map_err(|e| {
                crate::log_error!(&format!("extract_zip: failed to extract {:?}: {}", out_path, e), "download");
                format!("Failed to extract {:?}: {}", out_path, e)
            })?;
        }

        let _ = progress_tx.send(download_http::DownloadProgress {
            total,
            downloaded: i as u64 + 1,
            speed: 0.0,
        });
    }

    download_http::unregister_cancel_token(&dl_id, &state.cancel_tokens);
    Ok(dest_dir)
}

#[tauri::command]
pub async fn download_cuda_libs(
    state: tauri::State<'_, AppState>,
    tag: String,
    variant: String,
    dest_dir: String,
    dl_id: String,
    progress_tx: tauri::ipc::Channel<download_http::DownloadProgress>,
) -> Result<(), String> {
    let cuda_version = match variant.as_str() {
        "cuda12" => "12.4",
        "cuda13" => "13.3",
        _ => return Ok(()),
    };
    let cudart_asset = format!("cudart-llama-bin-win-cuda-{}-x64.zip", cuda_version);
    let cuda_url = format!(
        "https://github.com/ggml-org/llama.cpp/releases/download/{}/{}",
        tag, cudart_asset
    );
    crate::log_info!("[download_cuda_libs] downloading", "download", serde_json::json!({ "url": &cuda_url }));

    let zip_path = std::path::Path::new(&dest_dir).join("cublas.zip");
    let zip_str = zip_path.to_string_lossy().to_string();

    let result = crate::presentation::download_file::download_file(state.clone(), cuda_url, zip_str.clone(), dl_id.clone(), progress_tx.clone()).await;
    match result {
        Ok(_) => {
            extract_zip(state, zip_str, dest_dir, dl_id.clone(), progress_tx.clone()).await?;
            let _ = tokio::fs::remove_file(&zip_path).await;
        }
        Err(e) => {
            crate::log_warn!("[download_cuda_libs] cudart download failed (may not exist for this release)", "download", serde_json::json!({ "error": e }));
            let _ = tokio::fs::remove_file(&zip_path).await.ok();
        }
    }

    Ok(())
}

#[tauri::command]
pub async fn install_release(
    state: tauri::State<'_, AppState>,
    tag: String,
    variant: String,
    dl_id: String,
    progress_tx: tauri::ipc::Channel<download_http::DownloadProgress>,
) -> Result<String, String> {
    crate::log_info!("[install_release] starting", "download", serde_json::json!({ "tag": &tag, "variant": &variant, "dl_id": &dl_id }));

    let asset_name = crate::presentation::release_list::variant_to_asset_name(&tag, &variant);
    let zip_url = format!(
        "https://github.com/ggml-org/llama.cpp/releases/download/{}/{}",
        tag, asset_name
    );
    crate::log_info!("[install_release] downloading asset", "download", serde_json::json!({ "url": &zip_url }));

    let install_dir = {
        let config = state.config.read();
        let dir = std::path::Path::new(&config.models_directory).parent().unwrap_or(std::path::Path::new("."));
        dir.join("releases").join(&tag).join(&variant)
    };
    tokio::fs::create_dir_all(&install_dir).await.map_err(|e| format!("Failed to create install dir: {}", e))?;

    let zip_path = install_dir.join("release.zip");
    let zip_str = zip_path.to_string_lossy().to_string();
    let install_str = install_dir.to_string_lossy().to_string();

    crate::presentation::download_file::download_file(state.clone(), zip_url, zip_str.clone(), dl_id.clone(), progress_tx.clone()).await?;
    extract_zip(state.clone(), zip_str, install_str.clone(), dl_id.clone(), progress_tx.clone()).await?;
    let _ = tokio::fs::remove_file(&zip_path).await;

    let cuda_dir = install_dir.join("cublas");
    let cuda_str = cuda_dir.to_string_lossy().to_string();
    let _ = download_cuda_libs(state, tag.clone(), variant.clone(), cuda_str, dl_id.clone(), progress_tx.clone()).await;

    crate::log_info!("[install_release] completed", "download", serde_json::json!({ "tag": &tag, "variant": &variant, "path": &install_str }));
    Ok(install_str)
}
