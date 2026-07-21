use super::model_import::{ExternalModelDir, ExternalModelFile};
use super::model_import_detect::detect_model_info;

#[tauri::command]
pub async fn scan_external_models() -> Result<Vec<ExternalModelDir>, String> {
    let mut sources: Vec<(String, String, Vec<std::path::PathBuf>)> = Vec::new();

    if let Some(home) = dirs::home_dir() {
        let ollama_path = home.join(".ollama").join("models");
        if ollama_path.exists() {
            sources.push(("ollama".to_string(), "Ollama".to_string(), vec![ollama_path]));
        }
    }

    if let Some(home) = dirs::home_dir() {
        let lmstudio_paths = vec![
            home.join(".lmstudio").join("models"),
            home.join("LMStudio").join("models"),
            home.join(".cache").join("lm-studio").join("models"),
        ];
        let existing: Vec<_> = lmstudio_paths.into_iter().filter(|p| p.exists()).collect();
        if !existing.is_empty() {
            sources.push(("lmstudio".to_string(), "LM Studio".to_string(), existing));
        }
    }

    if let Some(home) = dirs::home_dir() {
        let hf_paths = vec![
            home.join(".cache").join("huggingface").join("hub"),
            home.join(".cache").join("huggingface"),
        ];
        let existing: Vec<_> = hf_paths.into_iter().filter(|p| p.exists()).collect();
        if !existing.is_empty() {
            sources.push(("huggingfacecli".to_string(), "HuggingFace CLI".to_string(), existing));
        }
    }

    let mut result = Vec::new();

    for (source_id, display_name, paths) in sources {
        let first_path = paths.first().cloned();
        let mut all_files = Vec::new();
        let mut total_size_mb = 0.0;

        for base_path in paths {
            if let Ok(files) = scan_model_files(&base_path).await {
                for file in files {
                    total_size_mb += file.size_mb;
                    all_files.push(file);
                }
            }
        }

        let model_count = all_files.len();

        let hash = md5::compute(display_name.as_bytes());
        let dir_id = format!("{}_{:x}", source_id, hash);

        result.push(ExternalModelDir {
            id: dir_id,
            source: source_id,
            display_name,
            path: first_path.map(|p| p.to_string_lossy().replace('\\', "/")).unwrap_or_default(),
            model_count,
            total_size_mb,
            enabled: true,
            files: all_files,
        });
    }

    Ok(result)
}

pub async fn scan_model_files(base_path: &std::path::Path) -> Result<Vec<ExternalModelFile>, String> {
    use tokio::fs;

    let mut files = Vec::new();

    let extensions = ["gguf", "ggml", "bin", "safetensors", "pt", "pth", "onnx", "trt", "engine"];

    let mut stack = vec![base_path.to_path_buf()];

    while let Some(current) = stack.pop() {
        if let Ok(entries) = fs::read_dir(&current).await {
            let mut entries = entries;
            while let Ok(Some(entry)) = entries.next_entry().await {
                let path = entry.path();

                if path.is_dir() {
                    if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
                        if !name.starts_with('.') && !matches!(name, "blobs" | "refs" | "snapshots" | "objects" | "pack" | ".git") {
                            stack.push(path);
                        }
                    }
                } else if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
                    if extensions.iter().any(|&e| e.eq_ignore_ascii_case(ext)) {
                        if let Ok(metadata) = fs::metadata(&path).await {
                            let size_mb = metadata.len() as f64 / (1024.0 * 1024.0);

                            let (format, params, quant) = detect_model_info(&path).await.unwrap_or((
                                ext.to_uppercase(),
                                None,
                                None,
                            ));

                            let file_id = format!("{:x}", md5::compute(format!("{}{}", path.display(), size_mb)));

                            files.push(ExternalModelFile {
                                id: file_id,
                                filename: path.file_name().and_then(|n| n.to_str()).unwrap_or("unknown").to_string(),
                                path: path.to_string_lossy().replace('\\', "/"),
                                size_mb,
                                format,
                                estimated_parameters: params,
                                quantization: quant,
                            });
                        }
                    }
                }
            }
        }
    }

    Ok(files)
}
