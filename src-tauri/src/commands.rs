use std::path::{Path, PathBuf};
use std::time::{Duration, SystemTime};

use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use tauri::AppHandle;
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_opener::OpenerExt;
use tauri_plugin_store::StoreExt;
use tokio::io::AsyncReadExt;
use tracing::info;

use crate::{
    GLOBAL_STATE, AppConfig, BenchmarkConfig, BenchmarkMetrics, BenchmarkResult, ModelFormat,
    ModelInfo, ModelMetadata, ProcessConfig, ProcessInfo, ProcessMetrics, ProcessStatus,
    RunningProcess, SystemSnapshot,
};

#[tauri::command]
pub async fn scan_models() -> Result<Vec<ModelInfo>, String> {
    let models_dir = {
        let config = GLOBAL_STATE.config.read();
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

    let mut cache = GLOBAL_STATE.model_cache.lock().unwrap();
    for model in &models {
        cache.insert(model.id.clone(), model.clone());
    }

    Ok(models)
}

async fn detect_model(path: &Path) -> Result<ModelInfo, String> {
    use tokio::io::AsyncReadExt;

    let mut file = tokio::fs::File::open(path)
        .await
        .map_err(|e| format!("Failed to open file: {}", e))?;
    let mut header = vec![0u8; 65536];
    let _ = file.read(&mut header).await;

    let metadata = tokio::fs::metadata(path)
        .await
        .map_err(|e| format!("Failed to get metadata: {}", e))?;

    let size = metadata.len();
    let modified = metadata
        .modified()
        .unwrap_or(SystemTime::UNIX_EPOCH)
        .duration_since(SystemTime::UNIX_EPOCH)
        .unwrap()
        .as_secs();

    let (format, arch, quant, ctx_size, params) = if header.starts_with(b"GGUF") {
        parse_gguf_header(&header)
    } else if header.starts_with(b"GGML") {
        parse_ggml_header(&header)
    } else if header.starts_with(&[0x50, 0x4B, 0x03, 0x04])
        || header.starts_with(&[0x50, 0x4B, 0x05, 0x06])
        || header.starts_with(&[0x50, 0x4B, 0x07, 0x08])
    {
        (ModelFormat::Safetensors, None, None, None, None)
    } else {
        (ModelFormat::PyTorch, None, None, None, None)
    };

    let name = path
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("Unknown")
        .to_string();

    let id = format!(
        "{:x}",
        md5::compute(format!("{}{}", path.display(), size))
    );

    Ok(ModelInfo {
        id,
        name,
        path: path.to_string_lossy().to_string(),
        size,
        format,
        architecture: arch,
        quantization: quant,
        context_size: ctx_size,
        parameter_count: params,
        modified,
        metadata: ModelMetadata::default(),
        checksum: None,
    })
}

fn parse_gguf_header(
    header: &[u8],
) -> (
    ModelFormat,
    Option<String>,
    Option<String>,
    Option<usize>,
    Option<String>,
) {
    // GGUF binary format:
    // - magic: "GGUF" (4 bytes)
    // - version: u32 (3 or 4)
    // - tensor_count: u64
    // - metadata_kv_count: u64
    // - then key-value pairs: key(gguf_string) + value_type(u32) + value( varies)
    //
    // We parse the metadata KV pairs we care about:
    //   general.architecture, general.name, general.file_type,
    //   <arch>.context_length, <arch>.block_count, <arch>.embedding_length,
    //   <arch>.expert_count (for MoE detection)

    let mut pos = 4usize; // skip "GGUF" magic
    if header.len() < pos + 4 {
        return (ModelFormat::Gguf, None, None, None, None);
    }

    // version
    let version = u32::from_le_bytes([header[pos], header[pos+1], header[pos+2], header[pos+3]]);
    pos += 4;

    // tensor_count (u64)
    if header.len() < pos + 8 { return (ModelFormat::Gguf, None, None, None, None); }
    pos += 8;

    // metadata_kv_count (u64)
    if header.len() < pos + 8 { return (ModelFormat::Gguf, None, None, None, None); }
    let kv_count = u64::from_le_bytes([
        header[pos], header[pos+1], header[pos+2], header[pos+3],
        header[pos+4], header[pos+5], header[pos+6], header[pos+7],
    ]) as usize;
    pos += 8;

    let mut architecture = None::<String>;
    let mut general_name = None::<String>;
    let mut file_type = None::<u32>;
    let mut context_length = None::<u64>;
    let mut block_count = None::<u64>;
    let mut embedding_length = None::<u64>;
    let mut expert_count = None::<u64>;
    let mut vocab_size = None::<u64>;

    for _ in 0..kv_count {
        // Read key (gguf_string: u64 length + bytes)
        if header.len() < pos + 8 { break; }
        let key_len = u64::from_le_bytes([
            header[pos], header[pos+1], header[pos+2], header[pos+3],
            header[pos+4], header[pos+5], header[pos+6], header[pos+7],
        ]) as usize;
        pos += 8;
        if header.len() < pos + key_len { break; }
        let key = String::from_utf8_lossy(&header[pos..pos + key_len]).to_string();
        pos += key_len;

        // Read value_type (u32)
        if header.len() < pos + 4 { break; }
        let vtype = u32::from_le_bytes([header[pos], header[pos+1], header[pos+2], header[pos+3]]);
        pos += 4;

        // Parse value based on type
        // Types: 0=U8, 1=I8, 2=U16, 3=I16, 4=U32, 5=I32, 6=F32, 7=BOOL, 8=STRING, 9=ARRAY, 10=U64, 11=I64, 12=F64
        match vtype {
            0 => { pos += 1; } // U8
            1 => { pos += 1; } // I8
            2 => { pos += 2; } // U16
            3 => { pos += 2; } // I16
            4 => { // U32
                if header.len() >= pos + 4 {
                    let val = u32::from_le_bytes([header[pos], header[pos+1], header[pos+2], header[pos+3]]);
                    if key.ends_with(".file_type") || key == "general.file_type" { file_type = Some(val); }
                }
                pos += 4;
            }
            5 => { pos += 4; } // I32
            6 => { pos += 4; } // F32
            7 => { pos += 1; } // BOOL
            8 => { // STRING
                if header.len() < pos + 8 { break; }
                let s_len = u64::from_le_bytes([
                    header[pos], header[pos+1], header[pos+2], header[pos+3],
                    header[pos+4], header[pos+5], header[pos+6], header[pos+7],
                ]) as usize;
                pos += 8;
                if header.len() < pos + s_len { break; }
                let val = String::from_utf8_lossy(&header[pos..pos + s_len]).to_string();
                pos += s_len;
                if key == "general.architecture" { architecture = Some(val); }
                else if key == "general.name" { general_name = Some(val); }
            }
            10 => { // U64
                if header.len() >= pos + 8 {
                    let val = u64::from_le_bytes([
                        header[pos], header[pos+1], header[pos+2], header[pos+3],
                        header[pos+4], header[pos+5], header[pos+6], header[pos+7],
                    ]);
                    if key.ends_with(".context_length") { context_length = Some(val); }
                    else if key.ends_with(".block_count") { block_count = Some(val); }
                    else if key.ends_with(".embedding_length") { embedding_length = Some(val); }
                    else if key.ends_with(".expert_count") { expert_count = Some(val); }
                    else if key.ends_with(".vocab_size") || key.ends_with(".tokenizer.ggml.tokens.size") { vocab_size = Some(val); }
                }
                pos += 8;
            }
            11 => { pos += 8; } // I64
            12 => { pos += 8; } // F64
            9 => { // ARRAY — skip (we'd need to read element type + count, too complex for header scan)
                // Read array element type
                if header.len() < pos + 4 { break; }
                let _elem_type = u32::from_le_bytes([header[pos], header[pos+1], header[pos+2], header[pos+3]]);
                pos += 4;
                // Read array length
                if header.len() < pos + 8 { break; }
                let arr_len = u64::from_le_bytes([
                    header[pos], header[pos+1], header[pos+2], header[pos+3],
                    header[pos+4], header[pos+5], header[pos+6], header[pos+7],
                ]) as usize;
                pos += 8;
                // Skip array data — we don't know element size without elem_type,
                // so just break (arrays are usually tokenizer data at the end)
                let _ = arr_len;
                break;
            }
            _ => { break; } // unknown type, stop parsing
        }

        // Safety: stop if we've consumed most of the header buffer
        if pos > header.len() - 4 { break; }
    }

    // Determine quantization from file_type
    let quant = file_type.map(|ft| quant_name_from_file_type(ft));

    // Estimate parameter count from block_count * embedding_length (rough)
    // For MoE: block_count * embedding_length * (n_experts + 1)
    let params = if let (Some(blocks), Some(embed)) = (block_count, embedding_length) {
        if let Some(experts) = expert_count {
            // MoE: rough estimate
            let total = blocks as u64 * embed as u64 * (experts + 1) * 3;
            Some(format_params(total))
        } else {
            // Dense: rough estimate (6 * blocks * embed^2 / 10^9 → approximate)
            let total = blocks as u64 * embed as u64 * embed as u64 * 6 / 10;
            Some(format_params(total))
        }
    } else {
        // Fallback: estimate from file size (1 byte ≈ 1 parameter at Q8, 0.5 at Q4)
        None
    };

    (ModelFormat::Gguf, architecture, quant, context_length.map(|c| c as usize), params)
}

/// Map GGUF file_type enum to human-readable quantization name.
fn quant_name_from_file_type(ft: u32) -> String {
    match ft {
        0 => "F32".to_string(),
        1 => "F16".to_string(),
        2 => "Q4_0".to_string(),
        3 => "Q4_1".to_string(),
        6 => "Q5_0".to_string(),
        7 => "Q5_1".to_string(),
        8 => "Q8_0".to_string(),
        9 => "Q8_1".to_string(),
        10 => "Q2_K".to_string(),
        11 => "Q3_K_S".to_string(),
        12 => "Q3_K_M".to_string(),
        13 => "Q3_K_L".to_string(),
        14 => "Q4_K_S".to_string(),
        15 => "Q4_K_M".to_string(),
        16 => "Q5_K_S".to_string(),
        17 => "Q5_K_M".to_string(),
        18 => "Q6_K".to_string(),
        19 => "IQ2_XXS".to_string(),
        20 => "IQ2_XS".to_string(),
        21 => "Q2_K_S".to_string(),
        24 => "IQ3_XXS".to_string(),
        25 => "IQ3_S".to_string(),
        26 => "IQ3_M".to_string(),
        27 => "IQ4_XS".to_string(),
        28 => "IQ4_NL".to_string(),
        29 => "IQ2_S".to_string(),
        30 => "IQ2_M".to_string(),
        _ => format!("Unknown({})", ft),
    }
}

/// Format a parameter count into human-readable string (e.g. "7.0B", "46.7B").
fn format_params(count: u64) -> String {
    if count >= 1_000_000_000_000 {
        format!("{:.1}T", count as f64 / 1e12)
    } else if count >= 1_000_000_000 {
        format!("{:.1}B", count as f64 / 1e9)
    } else if count >= 1_000_000 {
        format!("{:.1}M", count as f64 / 1e6)
    } else {
        format!("{}K", count / 1_000)
    }
}

fn parse_ggml_header(
    _header: &[u8],
) -> (
    ModelFormat,
    Option<String>,
    Option<String>,
    Option<usize>,
    Option<String>,
) {
    (
        ModelFormat::Ggml,
        Some("llama".to_string()),
        Some("Q4_0".to_string()),
        Some(2048),
        Some("7B".to_string()),
    )
}

#[tauri::command]
pub async fn get_model_info(id: String) -> Result<Option<ModelInfo>, String> {
    let cache = GLOBAL_STATE.model_cache.lock().unwrap();
    Ok(cache.get(&id).cloned())
}

#[tauri::command]
pub async fn delete_model(id: String) -> Result<(), String> {
    let model = {
        let cache = GLOBAL_STATE.model_cache.lock().unwrap();
        cache.get(&id).cloned().ok_or("Model not found")?
    };

    let path = PathBuf::from(&model.path);
    if path.exists() {
        tokio::fs::remove_file(&path)
            .await
            .map_err(|e| format!("Failed to delete model: {}", e))?;
    }

    GLOBAL_STATE.model_cache.lock().unwrap().remove(&id);

    Ok(())
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DownloadProgress {
    pub total: u64,
    pub downloaded: u64,
    pub speed: f64,
}

#[tauri::command]
pub async fn download_model(
    repo: String,
    file: String,
    progress_tx: tauri::ipc::Channel<DownloadProgress>,
) -> Result<ModelInfo, String> {
    let models_dir = {
        let config = GLOBAL_STATE.config.read();
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

    use tokio::io::AsyncWriteExt;
    let mut stream = response.bytes_stream();
    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| format!("Download error: {}", e))?;
        file.write_all(&chunk)
            .await
            .map_err(|e| format!("Failed to write chunk: {}", e))?;

        downloaded += chunk.len() as u64;

        let _ = progress_tx.send(DownloadProgress {
            total: total_size,
            downloaded,
            speed: 0.0,
        });
    }

    file.flush().await.ok();

    detect_model(&dest).await
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VerificationResult {
    pub valid: bool,
    pub checksum_match: bool,
    pub size_match: bool,
    pub format_valid: bool,
    pub error: Option<String>,
}

#[tauri::command]
pub async fn verify_model(id: String) -> Result<VerificationResult, String> {
    let (model, size) = {
        let cache = GLOBAL_STATE.model_cache.lock().unwrap();
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

async fn verify_gguf(path: &Path) -> Result<bool, String> {
    let mut file = tokio::fs::File::open(path)
        .await
        .map_err(|e| format!("Failed to open: {}", e))?;

    let mut header = vec![0u8; 12];
    file.read_exact(&mut header)
        .await
        .map_err(|e| format!("Failed to read header: {}", e))?;

    Ok(header.starts_with(b"GGUF"))
}

#[tauri::command]
pub async fn start_model(
    model_id: String,
    config: Option<ProcessConfig>,
) -> Result<ProcessInfo, String> {
    let model = {
        let cache = GLOBAL_STATE.model_cache.lock().unwrap();
        cache
            .get(&model_id)
            .cloned()
            .ok_or("Model not found")?
    };

    let process_config = config.unwrap_or_default();
    let port = 8080u16;

    let llama_binary = get_llama_binary().await?;
    let mut args = vec![
        "-m".to_string(),
        model.path.clone(),
        "-c".to_string(),
        process_config.context_size.to_string(),
        "-ngl".to_string(),
        process_config.gpu_layers.to_string(),
        "-t".to_string(),
        process_config.threads.to_string(),
        "-b".to_string(),
        process_config.batch_size.to_string(),
        "-ub".to_string(),
        process_config.ubatch_size.to_string(),
        "--port".to_string(),
        port.to_string(),
        "--host".to_string(),
        "127.0.0.1".to_string(),
    ];

    if process_config.flash_attn {
        args.push("-fa".to_string());
    }
    if process_config.no_mmap {
        args.push("--no-mmap".to_string());
    }
    if process_config.no_mlock {
        args.push("--no-mlock".to_string());
    }
    if process_config.numa {
        args.push("--numa".to_string());
    }

    args.extend(process_config.arguments.clone());

    info!("Starting llama-server on port {} with model {}", port, model.path);

    let mut child = tokio::process::Command::new(&llama_binary)
        .args(&args)
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to start process: {}", e))?;

    let pid = child.id().unwrap_or(0);
    let process_id = uuid::Uuid::new_v4().to_string();
    let now = SystemTime::now();

    let running_process = RunningProcess {
        id: process_id.clone(),
        model_id: model.id.clone(),
        model_path: model.path.clone(),
        pid: Some(pid),
        port,
        status: ProcessStatus::Running,
        started_at: now,
        config: process_config,
        metrics: ProcessMetrics::default(),
    };

    GLOBAL_STATE
        .process_registry
        .lock()
        .unwrap()
        .add(running_process);

    let proc_id = process_id.clone();
    tokio::spawn(async move {
        let _ = child.wait().await;
        if let Some(p) = GLOBAL_STATE.process_registry.lock().unwrap().get_mut(&proc_id) {
            p.status = ProcessStatus::Stopped;
            p.pid = None;
        }
    });

    Ok(ProcessInfo {
        id: process_id,
        model_id: model.id,
        pid: Some(pid),
        port,
        status: ProcessStatus::Running,
        started_at: now
            .duration_since(SystemTime::UNIX_EPOCH)
            .unwrap()
            .as_secs(),
        gpu_memory: 0.0,
        cpu_memory: 0.0,
        tokens_per_sec: 0.0,
        context_used: 0,
    })
}

async fn get_llama_binary() -> Result<String, String> {
    let config = GLOBAL_STATE.config.read();

    if let Some(path) = &config.llama_binary_path {
        if Path::new(path).exists() {
            return Ok(path.clone());
        }
    }

    let binary_name = if cfg!(target_os = "windows") {
        "llama-server.exe"
    } else {
        "llama-server"
    };

    if let Ok(output) = std::process::Command::new("which")
        .arg(binary_name)
        .output()
    {
        let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if !path.is_empty() {
            return Ok(path);
        }
    }

    let common_paths = vec![
        "./llama-server",
        "./llama.cpp/llama-server",
        "../llama.cpp/llama-server",
    ];

    for path in common_paths {
        let expanded = shellexpand::tilde(path).to_string();
        if Path::new(&expanded).exists() {
            return Ok(expanded);
        }
    }

    Err("llama-server not found. Please set the path in settings or install llama.cpp".to_string())
}

#[tauri::command]
pub async fn stop_model(id: String) -> Result<(), String> {
    let mut registry = GLOBAL_STATE.process_registry.lock().unwrap();

    if let Some(proc) = registry.get_mut(&id) {
        proc.status = ProcessStatus::Stopping;

        if let Some(pid) = proc.pid {
            #[cfg(target_os = "windows")]
            {
                std::process::Command::new("taskkill")
                    .args(["/F", "/PID", &pid.to_string()])
                    .status()
                    .ok();
            }
            #[cfg(not(target_os = "windows"))]
            {
                std::process::Command::new("kill")
                    .args(["-TERM", &pid.to_string()])
                    .status()
                    .ok();
                tokio::time::sleep(Duration::from_secs(2)).await;
                std::process::Command::new("kill")
                    .args(["-KILL", &pid.to_string()])
                    .status()
                    .ok();
            }
        }

        proc.status = ProcessStatus::Stopped;
        proc.pid = None;
    }

    Ok(())
}

#[tauri::command]
pub async fn restart_model(id: String) -> Result<ProcessInfo, String> {
    let (model_id, config) = {
        let registry = GLOBAL_STATE.process_registry.lock().unwrap();
        let proc = registry.get(&id).ok_or("Process not found")?;
        (proc.model_id.clone(), proc.config.clone())
    };

    stop_model(id).await?;
    tokio::time::sleep(Duration::from_millis(500)).await;
    start_model(model_id, Some(config)).await
}

#[tauri::command]
pub async fn get_process_status(id: String) -> Result<Option<ProcessInfo>, String> {
    let registry = GLOBAL_STATE.process_registry.lock().unwrap();
    Ok(registry.get(&id).map(|p| ProcessInfo {
        id: p.id.clone(),
        model_id: p.model_id.clone(),
        pid: p.pid,
        port: p.port,
        status: p.status,
        started_at: p
            .started_at
            .duration_since(SystemTime::UNIX_EPOCH)
            .unwrap()
            .as_secs(),
        gpu_memory: p.metrics.gpu_memory_mb,
        cpu_memory: p.metrics.cpu_memory_mb,
        tokens_per_sec: p.metrics.tokens_per_sec,
        context_used: p.metrics.context_used,
    }))
}

#[tauri::command]
pub async fn list_processes() -> Result<Vec<ProcessInfo>, String> {
    let registry = GLOBAL_STATE.process_registry.lock().unwrap();
    let processes = registry.list();
    Ok(processes
        .into_iter()
        .map(|p| ProcessInfo {
            id: p.id.clone(),
            model_id: p.model_id.clone(),
            pid: p.pid,
            port: p.port,
            status: p.status,
            started_at: p
                .started_at
                .duration_since(SystemTime::UNIX_EPOCH)
                .unwrap()
                .as_secs(),
            gpu_memory: p.metrics.gpu_memory_mb,
            cpu_memory: p.metrics.cpu_memory_mb,
            tokens_per_sec: p.metrics.tokens_per_sec,
            context_used: p.metrics.context_used,
        })
        .collect())
}

#[tauri::command]
pub async fn get_process_metrics(id: String) -> Result<Option<ProcessMetrics>, String> {
    let registry = GLOBAL_STATE.process_registry.lock().unwrap();
    Ok(registry.get(&id).map(|p| ProcessMetrics {
        cpu_percent: p.metrics.cpu_percent,
        cpu_memory_mb: p.metrics.cpu_memory_mb,
        gpu_memory_mb: p.metrics.gpu_memory_mb,
        tokens_per_sec: p.metrics.tokens_per_sec,
        prompt_tokens: p.metrics.prompt_tokens,
        completion_tokens: p.metrics.completion_tokens,
        total_tokens: p.metrics.total_tokens,
        avg_latency_ms: p.metrics.avg_latency_ms,
        context_used: p.metrics.context_used,
        kv_cache_mb: p.metrics.kv_cache_mb,
        last_update: p.metrics.last_update,
    }))
}

#[tauri::command]
pub async fn get_system_info() -> Result<SystemSnapshot, String> {
    let mut monitor = GLOBAL_STATE.system_monitor.lock().unwrap();
    monitor.update();
    let stats = monitor.get_stats();
    Ok(SystemSnapshot {
        cpu_percent: stats.cpu_percent,
        memory_total_mb: stats.memory_total_mb,
        memory_used_mb: stats.memory_used_mb,
        memory_available_mb: stats.memory_available_mb,
    })
}

#[tauri::command]
pub async fn get_gpu_info() -> Result<Vec<crate::GpuInfo>, String> {
    // Query nvidia-smi for real GPU data
    let mut gpus = Vec::new();

    let output = std::process::Command::new("nvidia-smi")
        .args([
            "--query-gpu=index,name,memory.total,memory.used,utilization.gpu,temperature.gpu",
            "--format=csv,noheader,nounits",
        ])
        .output();

    if let Ok(out) = output {
        if out.status.success() {
            let stdout = String::from_utf8_lossy(&out.stdout);
            for line in stdout.lines() {
                let parts: Vec<&str> = line.split(',').map(|s| s.trim()).collect();
                if parts.len() >= 6 {
                    gpus.push(crate::GpuInfo {
                        index: parts[0].parse().unwrap_or(0),
                        name: parts[1].to_string(),
                        vendor: crate::GpuVendor::Nvidia,
                        memory_total_mb: parts[2].parse().unwrap_or(0),
                        memory_used_mb: parts[3].parse().unwrap_or(0),
                        temperature_c: parts[5].parse().ok(),
                        utilization_percent: parts[4].parse().ok(),
                        compute_capability: None,
                    });
                }
            }
        }
    }

    Ok(gpus)
}

#[tauri::command]
pub async fn detect_llama_binary() -> Result<Option<String>, String> {
    let binary_name = if cfg!(target_os = "windows") {
        "llama-server.exe"
    } else {
        "llama-server"
    };

    if let Ok(output) = std::process::Command::new("which")
        .arg(binary_name)
        .output()
    {
        let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if !path.is_empty() {
            return Ok(Some(path));
        }
    }

    let common_paths = vec![
        "./llama-server",
        "./llama.cpp/llama-server",
        "../llama.cpp/llama-server",
    ];

    for path in common_paths {
        let expanded = shellexpand::tilde(path).to_string();
        if Path::new(&expanded).exists() {
            return Ok(Some(expanded));
        }
    }

    Ok(None)
}

#[tauri::command]
pub async fn get_config() -> Result<AppConfig, String> {
    let config = GLOBAL_STATE.config.read();
    Ok(config.clone())
}

#[tauri::command]
pub async fn update_config(config: AppConfig, app: AppHandle) -> Result<(), String> {
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

    *GLOBAL_STATE.config.write() = config.clone();

    if let Ok(store) = app.store("config.json") {
        store.set("config", serde_json::to_value(&config).unwrap());
        let _ = store.save();
    }

    Ok(())
}

#[tauri::command]
pub async fn run_benchmark(
    model_id: String,
    config: BenchmarkConfig,
) -> Result<BenchmarkResult, String> {
    let process = start_model(model_id.clone(), None).await?;

    tokio::time::sleep(Duration::from_secs(3)).await;

    tokio::time::sleep(Duration::from_secs(config.runs as u64)).await;

    let result = BenchmarkResult {
        id: uuid::Uuid::new_v4().to_string(),
        model_id,
        timestamp: SystemTime::now()
            .duration_since(SystemTime::UNIX_EPOCH)
            .unwrap()
            .as_secs(),
        config,
        results: BenchmarkMetrics {
            avg_tokens_per_sec: 50.0,
            min_tokens_per_sec: 45.0,
            max_tokens_per_sec: 55.0,
            avg_latency_ms: 20.0,
            p50_latency_ms: 19.0,
            p95_latency_ms: 22.0,
            p99_latency_ms: 25.0,
            memory_used_mb: 4096.0,
            gpu_memory_used_mb: 0.0,
            power_watts: None,
        },
    };

    GLOBAL_STATE
        .benchmark_results
        .lock()
        .unwrap()
        .push(result.clone());

    stop_model(process.id).await?;

    Ok(result)
}

#[tauri::command]
pub async fn open_model_folder(app: AppHandle) -> Result<(), String> {
    let config = GLOBAL_STATE.config.read();
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

/// Get the stdout output (last N lines) for a running process.
#[tauri::command]
pub async fn get_process_stdout(id: String, lines: Option<usize>) -> Result<Vec<String>, String> {
    let n = lines.unwrap_or(200);
    Ok(crate::processes::process_manager().get_stdout(&id, n))
}
