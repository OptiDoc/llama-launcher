use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::{Duration, SystemTime};

use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use tauri::AppHandle;
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_opener::OpenerExt;
use tauri_plugin_store::StoreExt;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tracing::{debug, info};

use crate::{
    GLOBAL_STATE, AppConfig, BenchmarkConfig, BenchmarkMetrics, BenchmarkResult, ModelFormat,
    ModelInfo, ModelMetadata, ProcessConfig, ProcessInfo, ProcessMetrics, ProcessStatus,
    RunningProcess, SystemSnapshot,
};
use crate::{log_debug, log_error, log_info, log_warn};

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

fn register_cancel_token(dl_id: &str) -> Arc<AtomicBool> {
    let flag = Arc::new(AtomicBool::new(false));
    let mut tokens = crate::GLOBAL_STATE.cancel_tokens.lock().unwrap();
    tokens.insert(dl_id.to_string(), flag.clone());
    flag
}

fn unregister_cancel_token(dl_id: &str) {
    let mut tokens = crate::GLOBAL_STATE.cancel_tokens.lock().unwrap();
    tokens.remove(dl_id);
}

#[tauri::command]
pub async fn cancel_download(dl_id: String) -> Result<(), String> {
    let mut tokens = crate::GLOBAL_STATE.cancel_tokens.lock().unwrap();
    if let Some(flag) = tokens.remove(&dl_id) {
        flag.store(true, Ordering::Relaxed);
        log_info!("[cancel_download] cancelled", "download", serde_json::json!({ "dl_id": &dl_id }));
        Ok(())
    } else {
        log_warn!("[cancel_download] no active download found", "download", serde_json::json!({ "dl_id": &dl_id }));
        Err("No active download found for this ID".to_string())
    }
}

#[tauri::command]
pub async fn download_model(
    repo: String,
    file: String,
    dl_id: String,
    progress_tx: tauri::ipc::Channel<DownloadProgress>,
) -> Result<ModelInfo, String> {
    let _cancel = register_cancel_token(&dl_id);
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
            debug!("Download progress channel closed");
            break;
        }
    }

    file.flush().await.ok();
    unregister_cancel_token(&dl_id);

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

    let pc = config.unwrap_or_default();
    let port = pc.port;

    let llama_binary = get_llama_binary().await?;
    let mut args = vec![
        "-m".to_string(), model.path.clone(),
        "-c".to_string(), pc.context_size.to_string(),
        "-ngl".to_string(), pc.gpu_layers.to_string(),
        "-t".to_string(), pc.threads.to_string(),
        "-b".to_string(), pc.batch_size.to_string(),
        "-ub".to_string(), pc.ubatch_size.to_string(),
        "--port".to_string(), pc.port.to_string(),
        "--host".to_string(), pc.host.clone(),
    ];

    // Server
    if pc.parallel != -1 { args.push("-np".into()); args.push(pc.parallel.to_string()); }
    if !pc.cont_batching { args.push("--no-cont-batching".into()); }
    if pc.n_predict != -1 { args.push("-n".into()); args.push(pc.n_predict.to_string()); }
    if pc.timeout != 3600 { args.push("--timeout".into()); args.push(pc.timeout.to_string()); }
    if pc.metrics { args.push("--metrics".into()); }
    if !pc.api_key.is_empty() { args.push("--api-key".into()); args.push(pc.api_key.clone()); }

    // Performance
    if pc.threads_batch != -1 { args.push("-tb".into()); args.push(pc.threads_batch.to_string()); }
    if pc.cache_type_k != "f16" { args.push("-ctk".into()); args.push(pc.cache_type_k.clone()); }
    if pc.cache_type_v != "f16" { args.push("-ctv".into()); args.push(pc.cache_type_v.clone()); }
    if pc.split_mode != "layer" { args.push("-sm".into()); args.push(pc.split_mode.clone()); }
    if !pc.tensor_split.is_empty() { args.push("-ts".into()); args.push(pc.tensor_split.clone()); }
    if pc.main_gpu != 0 { args.push("-mg".into()); args.push(pc.main_gpu.to_string()); }
    if !pc.kv_offload { args.push("--no-kv-offload".into()); }
    if !pc.fit { args.push("--no-fit".into()); }

    // Flash attention (three-state: on/off/auto)
    if pc.flash_attn { args.push("-fa".into()); args.push("on".into()); }
    else { args.push("-fa".into()); args.push("off".into()); }

    // Memory
    if pc.no_mmap { args.push("--no-mmap".into()); }
    if pc.no_mlock { args.push("--mlock".into()); }
    if pc.numa { args.push("--numa".into()); args.push("distribute".into()); }

    // Sampling
    if (pc.temperature - 0.8).abs() > f32::EPSILON { args.push("--temp".into()); args.push(pc.temperature.to_string()); }
    if pc.top_k != 40 { args.push("--top-k".into()); args.push(pc.top_k.to_string()); }
    if (pc.top_p - 0.95).abs() > f32::EPSILON { args.push("--top-p".into()); args.push(pc.top_p.to_string()); }
    if (pc.min_p - 0.05).abs() > f32::EPSILON { args.push("--min-p".into()); args.push(pc.min_p.to_string()); }
    if (pc.repeat_penalty - 1.0).abs() > f32::EPSILON { args.push("--repeat-penalty".into()); args.push(pc.repeat_penalty.to_string()); }
    if pc.repeat_last_n != 64 { args.push("--repeat-last-n".into()); args.push(pc.repeat_last_n.to_string()); }
    if pc.presence_penalty > f32::EPSILON { args.push("--presence-penalty".into()); args.push(pc.presence_penalty.to_string()); }
    if pc.frequency_penalty > f32::EPSILON { args.push("--frequency-penalty".into()); args.push(pc.frequency_penalty.to_string()); }
    if pc.seed != -1 { args.push("-s".into()); args.push(pc.seed.to_string()); }

    // Advanced
    if !pc.lora.is_empty() { args.push("--lora".into()); args.push(pc.lora.clone()); }
    if !pc.mmproj.is_empty() { args.push("-mm".into()); args.push(pc.mmproj.clone()); }
    if pc.jinja { args.push("--jinja".into()); }
    if !pc.reasoning_format.is_empty() && pc.reasoning_format != "auto" {
        args.push("--reasoning-format".into()); args.push(pc.reasoning_format.clone());
    }
    if pc.reasoning_budget != -1 { args.push("--reasoning-budget".into()); args.push(pc.reasoning_budget.to_string()); }
    if !pc.chat_template.is_empty() { args.push("--chat-template".into()); args.push(pc.chat_template.clone()); }
    if !pc.rope_scaling.is_empty() { args.push("--rope-scaling".into()); args.push(pc.rope_scaling.clone()); }
    if pc.rope_scale > f32::EPSILON { args.push("--rope-scale".into()); args.push(pc.rope_scale.to_string()); }
    if pc.rope_freq_base > f32::EPSILON { args.push("--rope-freq-base".into()); args.push(pc.rope_freq_base.to_string()); }
    if pc.rope_freq_scale > f32::EPSILON { args.push("--rope-freq-scale".into()); args.push(pc.rope_freq_scale.to_string()); }
    if !pc.grammar.is_empty() { args.push("--grammar".into()); args.push(pc.grammar.clone()); }
    if !pc.json_schema.is_empty() { args.push("-j".into()); args.push(pc.json_schema.clone()); }
    if pc.log_level != 3 { args.push("-lv".into()); args.push(pc.log_level.to_string()); }

    args.extend(pc.arguments.clone());

    info!("Starting llama-server on port {} with model {}", pc.port, model.path);

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
        port: port,
        status: ProcessStatus::Running,
        started_at: now,
        config: pc,
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
        port: port,
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
    let binary_path = {
        let config = GLOBAL_STATE.config.read();
        config.llama_binary_path.clone()
    };

    if let Some(path) = &binary_path {
        if Path::new(path).exists() {
            return Ok(path.clone());
        }
    }

    let binary_name = if cfg!(target_os = "windows") {
        "llama-server.exe"
    } else {
        "llama-server"
    };

    if let Ok(output) = tokio::process::Command::new("which")
        .arg(binary_name)
        .output()
        .await
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
    let pid = {
        let mut registry = GLOBAL_STATE.process_registry.lock().unwrap();
        if let Some(proc) = registry.get_mut(&id) {
            proc.status = ProcessStatus::Stopping;
            proc.pid
        } else {
            return Ok(());
        }
    };

    if let Some(pid) = pid {
        #[cfg(target_os = "windows")]
        {
            tokio::process::Command::new("taskkill")
                .args(["/F", "/PID", &pid.to_string()])
                .output()
                .await
                .ok();
        }
        #[cfg(not(target_os = "windows"))]
        {
            tokio::process::Command::new("kill")
                .args(["-TERM", &pid.to_string()])
                .output()
                .await
                .ok();
            tokio::time::sleep(Duration::from_secs(2)).await;
            tokio::process::Command::new("kill")
                .args(["-KILL", &pid.to_string()])
                .output()
                .await
                .ok();
        }
    }

    {
        let mut registry = GLOBAL_STATE.process_registry.lock().unwrap();
        if let Some(proc) = registry.get_mut(&id) {
            proc.status = ProcessStatus::Stopped;
            proc.pid = None;
        }
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
        cpu_name: stats.cpu_name,
        cpu_cores_physical: stats.cpu_cores_physical,
        cpu_cores_logical: stats.cpu_cores_logical,
        memory_total_mb: stats.memory_total_mb,
        memory_used_mb: stats.memory_used_mb,
        memory_available_mb: stats.memory_available_mb,
        disk_total_gb: stats.disk_total_gb,
        disk_used_gb: stats.disk_used_gb,
        disk_free_gb: stats.disk_free_gb,
        os_name: stats.os_name,
        os_version: stats.os_version,
    })
}

#[tauri::command]
pub async fn get_gpu_info() -> Result<Vec<crate::GpuInfo>, String> {
    let mut gpus = Vec::new();

    // Try NVIDIA first
    if let Ok(out) = tokio::process::Command::new("nvidia-smi")
        .args([
            "--query-gpu=index,name,memory.total,memory.used,memory.free,utilization.gpu,temperature.gpu,compute_cap,driver_version",
            "--format=csv,noheader,nounits",
        ])
        .output()
        .await
    {
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
                        memory_free_mb: parts.get(4).and_then(|s| s.parse().ok()).unwrap_or(0),
                        utilization_percent: parts.get(5).and_then(|s| s.parse().ok()),
                        temperature_c: parts.get(6).and_then(|s| s.parse().ok()),
                        compute_capability: parts.get(7).filter(|s| !s.is_empty()).map(|s| s.to_string()),
                        driver_version: parts.get(8).filter(|s| !s.is_empty()).map(|s| s.to_string()),
                    });
                }
            }
        }
    }

    // If no NVIDIA GPUs found, try AMD (Linux: rocm-smi, Windows: WMI)
    if gpus.is_empty() {
        #[cfg(target_os = "linux")]
        {
            if let Ok(out) = tokio::process::Command::new("rocm-smi")
                .args(["--showproductname", "--showmeminfo", "vram", "--showuse", "--showtemp", "--csv"])
                .output()
                .await
            {
                if out.status.success() {
                    let stdout = String::from_utf8_lossy(&out.stdout);
                    let lines: Vec<&str> = stdout.lines().collect();
                    for (i, line) in lines.iter().enumerate().skip(1) {
                        let parts: Vec<&str> = line.split(',').map(|s| s.trim()).collect();
                        if !parts.is_empty() {
                            let name = parts[0].to_string();
                            let mut vram_total = 0u64;
                            let mut vram_used = 0u64;
                            let mut temp = None;
                            let mut util = None;
                            for p in &parts[1..] {
                                if let Ok(v) = p.parse::<u64>() {
                                    if v > 1_000_000 {
                                        vram_total = v / (1024 * 1024);
                                    } else if v > 100 && vram_total == 0 {
                                        vram_total = v;
                                    } else if v > 100 && vram_total > 0 && vram_used == 0 {
                                        vram_used = v;
                                    }
                                }
                                if let Ok(v) = p.parse::<f32>() {
                                    if v > 0.0 && v <= 100.0 && util.is_none() {
                                        util = Some(v as u32);
                                    } else if v > 0.0 && v < 200.0 && temp.is_none() {
                                        temp = Some(v as u32);
                                    }
                                }
                            }
                            gpus.push(crate::GpuInfo {
                                index: i - 1,
                                name,
                                vendor: crate::GpuVendor::Amd,
                                memory_total_mb: vram_total,
                                memory_used_mb: vram_used,
                                memory_free_mb: vram_total.saturating_sub(vram_used),
                                utilization_percent: util,
                                temperature_c: temp,
                                compute_capability: None,
                                driver_version: None,
                            });
                        }
                    }
                }
            }
        }

        #[cfg(target_os = "windows")]
        {
            if let Ok(out) = tokio::process::Command::new("wmic")
                .args(["path", "win32_videocontroller", "get", "name,AdapterRAM,DriverVersion", "/format:csv"])
                .output()
                .await
            {
                if out.status.success() {
                    let stdout = String::from_utf8_lossy(&out.stdout);
                    for (i, line) in stdout.lines().enumerate().skip(1) {
                        let parts: Vec<&str> = line.split(',').collect();
                        if parts.len() >= 3 {
                            let name = parts.get(2).unwrap_or(&"GPU").trim().to_string();
                            let ram_bytes: u64 = parts.get(1).unwrap_or(&"0").trim().parse().unwrap_or(0);
                            let driver = parts.get(3).filter(|s| !s.trim().is_empty()).map(|s| s.trim().to_string());
                            let vendor = if name.to_lowercase().contains("nvidia") { crate::GpuVendor::Nvidia }
                                else if name.to_lowercase().contains("amd") || name.to_lowercase().contains("radeon") { crate::GpuVendor::Amd }
                                else if name.to_lowercase().contains("intel") { crate::GpuVendor::Intel }
                                else { crate::GpuVendor::Other };
                            gpus.push(crate::GpuInfo {
                                index: i,
                                name,
                                vendor,
                                memory_total_mb: ram_bytes / (1024 * 1024),
                                memory_used_mb: 0,
                                memory_free_mb: ram_bytes / (1024 * 1024),
                                utilization_percent: None,
                                temperature_c: None,
                                compute_capability: None,
                                driver_version: driver,
                            });
                        }
                    }
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

    if let Ok(output) = tokio::process::Command::new("which")
        .arg(binary_name)
        .output()
        .await
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

    // Wait for llama-server to be ready
    tokio::time::sleep(Duration::from_secs(3)).await;

    let port = process.port;
    let url = format!("http://127.0.0.1:{}/v1/completions", port);
    let client = reqwest::Client::new();

    let prompt_text = if config.prompt.is_empty() {
        "Once upon a time".to_string()
    } else {
        config.prompt.clone()
    };

    // Warmup runs
    for _ in 0..config.warmup_runs {
        let _ = client
            .post(&url)
            .json(&serde_json::json!({
                "prompt": &prompt_text,
                "n_predict": 16,
                "stream": false,
            }))
            .send()
            .await;
    }

    // Real benchmark runs — measure tokens/sec and latency
    let mut tps_samples = Vec::new();
    let mut latency_samples = Vec::new();
    let mut total_prompt_tokens = 0u64;
    let mut total_completion_tokens = 0u64;

    for _ in 0..config.runs {
        let start = std::time::Instant::now();
        let response = client
            .post(&url)
            .json(&serde_json::json!({
                "prompt": &prompt_text,
                "n_predict": config.n_predict,
                "stream": false,
            }))
            .send()
            .await;

        if let Ok(resp) = response {
            let elapsed_ms = start.elapsed().as_millis() as f64;
            latency_samples.push(elapsed_ms);

            if let Ok(json) = resp.json::<serde_json::Value>().await {
                // llama-server returns timings in the response
                let timings = &json["timings"];
                if !timings.is_null() {
                    let predicted_n = timings["predicted_n"].as_u64().unwrap_or(config.n_predict as u64);
                    let predicted_ms = timings["predicted_ms"].as_f64().unwrap_or(elapsed_ms);
                    if predicted_ms > 0.0 && predicted_n > 0 {
                        let tps = predicted_n as f64 / (predicted_ms / 1000.0);
                        tps_samples.push(tps as f32);
                    }
                    total_prompt_tokens += timings["prompt_n"].as_u64().unwrap_or(0);
                    total_completion_tokens += predicted_n;
                } else {
                    // Fallback: estimate from elapsed time
                    if elapsed_ms > 0.0 {
                        tps_samples.push((config.n_predict as f64 / (elapsed_ms / 1000.0)) as f32);
                        total_completion_tokens += config.n_predict as u64;
                    }
                }
            }
        }
    }

    // Get process metrics
    let (mem_mb, gpu_mb) = {
        let registry = GLOBAL_STATE.process_registry.lock().unwrap();
        if let Some(p) = registry.get(&process.id) {
            (p.metrics.cpu_memory_mb, p.metrics.gpu_memory_mb)
        } else {
            (0.0, 0.0)
        }
    };

    // Calculate statistics
    let avg_tps = if tps_samples.is_empty() { 0.0 } else { tps_samples.iter().sum::<f32>() / tps_samples.len() as f32 };
    let min_tps = tps_samples.iter().cloned().fold(f32::INFINITY, f32::min);
    let max_tps = tps_samples.iter().cloned().fold(0.0f32, f32::max);
    let avg_latency = if latency_samples.is_empty() { 0.0 } else { latency_samples.iter().sum::<f64>() / latency_samples.len() as f64 };

    // Percentiles
    let mut sorted_lat = latency_samples.clone();
    sorted_lat.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
    let p50 = percentile(&sorted_lat, 0.50);
    let p95 = percentile(&sorted_lat, 0.95);
    let p99 = percentile(&sorted_lat, 0.99);

    let result = BenchmarkResult {
        id: uuid::Uuid::new_v4().to_string(),
        model_id: model_id.clone(),
        timestamp: SystemTime::now()
            .duration_since(SystemTime::UNIX_EPOCH)
            .unwrap()
            .as_secs(),
        config,
        results: BenchmarkMetrics {
            avg_tokens_per_sec: avg_tps,
            min_tokens_per_sec: if tps_samples.is_empty() { 0.0 } else { min_tps },
            max_tokens_per_sec: max_tps,
            avg_latency_ms: avg_latency as f32,
            p50_latency_ms: p50 as f32,
            p95_latency_ms: p95 as f32,
            p99_latency_ms: p99 as f32,
            memory_used_mb: mem_mb,
            gpu_memory_used_mb: gpu_mb,
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

/// Calculate the p-th percentile of a sorted slice.
fn percentile(sorted: &[f64], p: f64) -> f64 {
    if sorted.is_empty() {
        return 0.0;
    }
    let idx = ((sorted.len() as f64 - 1.0) * p).round() as usize;
    sorted[idx.min(sorted.len() - 1)]
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

// ---------- Download / File helpers ----------

#[tauri::command]
pub async fn download_file(
    url: String,
    dest: String,
    dl_id: String,
    progress_tx: tauri::ipc::Channel<DownloadProgress>,
) -> Result<String, String> {
    let cancel = register_cancel_token(&dl_id);

    log_info!("[download_file] starting", "download", serde_json::json!({ "url": &url, "dest": &dest, "dl_id": &dl_id }));

    let expanded_dest = if dest.starts_with("~/") || dest.starts_with("~\\") {
        let home = if cfg!(windows) {
            std::env::var("USERPROFILE").ok()
        } else {
            std::env::var("HOME").ok()
        };
        let home = home.ok_or_else(|| {
            unregister_cancel_token(&dl_id);
            log_error!("[download_file] cannot determine home directory", "download", serde_json::json!({ "dl_id": &dl_id }));
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
            unregister_cancel_token(&dl_id);
            log_error!("[download_file] failed to create directory", "download", serde_json::json!({ "path": parent.to_string_lossy().to_string(), "error": e.to_string() }));
            format!("Failed to create directory: {}", e)
        })?;
    }

    let client = reqwest::Client::builder()
        .user_agent("llama-launcher")
        .build()
        .map_err(|e| {
            unregister_cancel_token(&dl_id);
            log_error!("[download_file] failed to create HTTP client", "download", serde_json::json!({ "error": e.to_string() }));
            format!("Failed to create HTTP client: {}", e)
        })?;

    let response = client.get(&url).send().await.map_err(|e| {
        unregister_cancel_token(&dl_id);
        log_error!("[download_file] failed to start download", "download", serde_json::json!({ "url": &url, "error": e.to_string() }));
        format!("Failed to start download: {}", e)
    })?;

    let status = response.status();
    if !status.is_success() {
        unregister_cancel_token(&dl_id);
        let msg = format!("HTTP {}: {}", status.as_u16(), status.canonical_reason().unwrap_or("Unknown"));
        log_error!("[download_file] non-success HTTP status", "download", serde_json::json!({ "url": &url, "status": status.as_u16(), "error": &msg }));
        return Err(msg);
    }

    let content_type = response.headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");
    if content_type.contains("text/html") {
        unregister_cancel_token(&dl_id);
        log_error!("[download_file] server returned HTML instead of binary", "download", serde_json::json!({ "url": &url, "content_type": &content_type }));
        return Err("Server returned HTML (likely an error page) instead of a binary file".to_string());
    }

    let total_size = response.content_length().unwrap_or(0);

    if total_size > 0 && total_size < 1_000_000 {
        unregister_cancel_token(&dl_id);
        log_error!("[download_file] file too small", "download", serde_json::json!({ "url": &url, "total_size": total_size }));
        return Err(format!("File too small ({} bytes) - likely an error page", total_size));
    }

    log_info!("[download_file] accepted", "download", serde_json::json!({ "total_size": total_size, "dest": &expanded_dest }));

    let mut downloaded = 0u64;
    let mut file = tokio::fs::File::create(&dest_path).await.map_err(|e| {
        unregister_cancel_token(&dl_id);
        log_error!("[download_file] failed to create file", "download", serde_json::json!({ "path": &expanded_dest, "error": e.to_string() }));
        format!("Failed to create file {}: {}", expanded_dest, e)
    })?;

    let mut stream = response.bytes_stream();
    let mut last_update = tokio::time::Instant::now();
    let mut last_bytes = 0u64;

    while let Some(chunk) = stream.next().await {
        if cancel.load(Ordering::Relaxed) {
            let _ = tokio::fs::remove_file(&dest_path).await;
            unregister_cancel_token(&dl_id);
            log_warn!("[download_file] cancelled by user", "download", serde_json::json!({ "dl_id": &dl_id, "downloaded": downloaded }));
            return Err("Download cancelled".to_string());
        }

        let chunk = chunk.map_err(|e| {
            log_error!("[download_file] stream error", "download", serde_json::json!({ "error": e.to_string(), "downloaded": downloaded }));
            format!("Download error: {}", e)
        })?;

        file.write_all(&chunk).await.map_err(|e| {
            log_error!("[download_file] write error", "download", serde_json::json!({ "error": e.to_string(), "downloaded": downloaded }));
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
                log_debug!("[download_file] progress channel closed", "download");
                break;
            }
        }
    }

    file.flush().await.ok();
    unregister_cancel_token(&dl_id);

    if total_size > 0 {
        let metadata = tokio::fs::metadata(&dest_path).await.map_err(|e| {
            log_error!("[download_file] failed to stat downloaded file", "download", serde_json::json!({ "path": &expanded_dest, "error": e.to_string() }));
            format!("Failed to stat downloaded file: {}", e)
        })?;
        if metadata.len() < 1_000_000 {
            let _ = tokio::fs::remove_file(&dest_path).await;
            log_error!("[download_file] downloaded file too small", "download", serde_json::json!({ "path": &expanded_dest, "size": metadata.len() }));
            return Err(format!("Downloaded file too small ({} bytes) - likely an error page", metadata.len()));
        }
    }

    log_info!("[download_file] completed", "download", serde_json::json!({ "path": &expanded_dest, "size": downloaded }));
    Ok(expanded_dest)
}

#[tauri::command]
pub async fn extract_zip(
    zip_path: String,
    dest_dir: String,
    dl_id: String,
    progress_tx: tauri::ipc::Channel<DownloadProgress>,
) -> Result<String, String> {
    let _cancel = register_cancel_token(&dl_id);
    tokio::fs::create_dir_all(&dest_dir).await.map_err(|e| {
        unregister_cancel_token(&dl_id);
        format!("Failed to create extract directory: {}", e)
    })?;

    let file = std::fs::File::open(&zip_path).map_err(|e| {
        unregister_cancel_token(&dl_id);
        format!("Failed to open zip file: {}", e)
    })?;

    let mut archive = zip::ZipArchive::new(file).map_err(|e| {
        unregister_cancel_token(&dl_id);
        format!("Failed to read zip archive: {}", e)
    })?;

    let total = archive.len() as u64;
    for i in 0..archive.len() {
        if _cancel.load(Ordering::Relaxed) {
            unregister_cancel_token(&dl_id);
            return Err("Extraction cancelled".to_string());
        }

        let mut entry = archive.by_index(i).map_err(|e| {
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
                format!("Failed to create file {:?}: {}", out_path, e)
            })?;
            std::io::copy(&mut entry, &mut outfile).map_err(|e| {
                format!("Failed to extract {:?}: {}", out_path, e)
            })?;
        }

        let _ = progress_tx.send(DownloadProgress {
            total,
            downloaded: i as u64 + 1,
            speed: 0.0,
        });
    }

    unregister_cancel_token(&dl_id);
    Ok(dest_dir)
}

#[tauri::command]
pub async fn download_cuda_libs(
    tag: String,
    variant: String,
    dest_dir: String,
    dl_id: String,
    progress_tx: tauri::ipc::Channel<DownloadProgress>,
) -> Result<(), String> {
    let cuda_url = format!(
        "https://github.com/ggml-org/llama.cpp/releases/download/{}/cublas-{}-{}-archive.zip",
        tag, tag, variant
    );
    let zip_path = std::path::Path::new(&dest_dir).join("cublas.zip");
    let zip_str = zip_path.to_string_lossy().to_string();

    download_file(cuda_url, zip_str.clone(), dl_id.clone(), progress_tx.clone()).await?;
    extract_zip(zip_str, dest_dir, dl_id.clone(), progress_tx.clone()).await?;
    let _ = tokio::fs::remove_file(&zip_path).await;

    Ok(())
}

#[tauri::command]
pub async fn install_release(
    tag: String,
    variant: String,
    dl_id: String,
    progress_tx: tauri::ipc::Channel<DownloadProgress>,
) -> Result<String, String> {
    log_info!("[install_release] starting", "download", serde_json::json!({ "tag": &tag, "variant": &variant, "dl_id": &dl_id }));

    let zip_url = format!(
        "https://github.com/ggml-org/llama.cpp/releases/download/{}/llama-{}-{}-archive.zip",
        tag, tag, variant
    );

    let install_dir = {
        let config = crate::GLOBAL_STATE.config.read();
        let dir = std::path::Path::new(&config.models_directory).parent().unwrap_or(std::path::Path::new("."));
        dir.join("releases").join(&tag).join(&variant)
    };
    tokio::fs::create_dir_all(&install_dir).await.map_err(|e| format!("Failed to create install dir: {}", e))?;

    let zip_path = install_dir.join("release.zip");
    let zip_str = zip_path.to_string_lossy().to_string();
    let install_str = install_dir.to_string_lossy().to_string();

    download_file(zip_url, zip_str.clone(), dl_id.clone(), progress_tx.clone()).await?;
    extract_zip(zip_str, install_str.clone(), dl_id.clone(), progress_tx.clone()).await?;
    let _ = tokio::fs::remove_file(&zip_path).await;

    // Optionally download CUDA libs
    let cuda_dir = install_dir.join("cublas");
    let cuda_str = cuda_dir.to_string_lossy().to_string();
    let _ = download_cuda_libs(tag.clone(), variant.clone(), cuda_str, dl_id.clone(), progress_tx.clone()).await;

    log_info!("[install_release] completed", "download", serde_json::json!({ "tag": &tag, "variant": &variant, "path": &install_str }));
    Ok(install_str)
}

// ---------- Directory / App helpers ----------

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
    Ok(dir.to_string_lossy().to_string())
}

// ---------- External Models ----------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExternalModelDir {
    pub path: String,
    pub recursive: bool,
}

#[tauri::command]
pub async fn scan_external_models() -> Result<Vec<ExternalModelDir>, String> {
    Ok(Vec::new())
}

#[tauri::command]
pub async fn sync_external_models(dirs: Vec<ExternalModelDir>) -> Result<usize, String> {
    Ok(0)
}
