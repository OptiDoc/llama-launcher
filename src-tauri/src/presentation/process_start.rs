use std::path::Path;
use std::time::SystemTime;

use tauri::AppHandle;
use tauri::Manager;

use crate::application::AppState;
use crate::domain::{AppConfig, ProcessConfig, ProcessInfo, ProcessMetrics, ProcessStatus, RunningProcess};

#[tauri::command]
pub async fn start_model(
    state: tauri::State<'_, AppState>,
    app: AppHandle,
    model_id: String,
    config: Option<ProcessConfig>,
) -> Result<ProcessInfo, String> {
    let model = {
        let cache = state.model_cache.lock().unwrap();
        cache
            .get(&model_id)
            .cloned()
            .ok_or("Model not found")?
    };

    let pc = config.unwrap_or_default();
    let port = pc.port;

    let config = state.config.read().clone();
    let llama_binary = get_llama_binary(&config).await?;

    let args = build_args(&model.path, &pc);

    crate::log_info!(&format!("Starting llama-server on port {} with model {}", pc.port, model.path), "commands");

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

    state
        .process_registry
        .lock()
        .unwrap()
        .add(running_process);

    let proc_id = process_id.clone();
    let app2 = app.clone();
    tokio::spawn(async move {
        let _ = child.wait().await;
        let state = app2.state::<AppState>();
        let mut registry = state.process_registry.lock().unwrap();
        if let Some(p) = registry.get_mut(&proc_id) {
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

fn build_args(model_path: &str, pc: &ProcessConfig) -> Vec<String> {
    let mut args = vec![
        "-m".to_string(), model_path.to_string(),
        "-c".to_string(), pc.context_size.to_string(),
        "-ngl".to_string(), pc.gpu_layers.to_string(),
        "-t".to_string(), pc.threads.to_string(),
        "-b".to_string(), pc.batch_size.to_string(),
        "-ub".to_string(), pc.ubatch_size.to_string(),
        "--port".to_string(), pc.port.to_string(),
        "--host".to_string(), pc.host.clone(),
    ];

    if pc.parallel != -1 { args.push("-np".into()); args.push(pc.parallel.to_string()); }
    if !pc.cont_batching { args.push("--no-cont-batching".into()); }
    if pc.n_predict != -1 { args.push("-n".into()); args.push(pc.n_predict.to_string()); }
    if pc.timeout != 3600 { args.push("--timeout".into()); args.push(pc.timeout.to_string()); }
    if pc.metrics { args.push("--metrics".into()); }
    if !pc.api_key.is_empty() { args.push("--api-key".into()); args.push(pc.api_key.clone()); }

    if pc.threads_batch != -1 { args.push("-tb".into()); args.push(pc.threads_batch.to_string()); }
    if pc.cache_type_k != "f16" { args.push("-ctk".into()); args.push(pc.cache_type_k.clone()); }
    if pc.cache_type_v != "f16" { args.push("-ctv".into()); args.push(pc.cache_type_v.clone()); }
    if pc.split_mode != "layer" { args.push("-sm".into()); args.push(pc.split_mode.clone()); }
    if !pc.tensor_split.is_empty() { args.push("-ts".into()); args.push(pc.tensor_split.clone()); }
    if pc.main_gpu != 0 { args.push("-mg".into()); args.push(pc.main_gpu.to_string()); }
    if !pc.kv_offload { args.push("--no-kv-offload".into()); }
    if !pc.fit { args.push("--no-fit".into()); }

    if pc.flash_attn { args.push("-fa".into()); args.push("on".into()); }
    else { args.push("-fa".into()); args.push("off".into()); }

    if pc.no_mmap { args.push("--no-mmap".into()); }
    if pc.no_mlock { args.push("--mlock".into()); }
    if pc.numa { args.push("--numa".into()); args.push("distribute".into()); }

    if (pc.temperature - 0.8).abs() > f32::EPSILON { args.push("--temp".into()); args.push(pc.temperature.to_string()); }
    if pc.top_k != 40 { args.push("--top-k".into()); args.push(pc.top_k.to_string()); }
    if (pc.top_p - 0.95).abs() > f32::EPSILON { args.push("--top-p".into()); args.push(pc.top_p.to_string()); }
    if (pc.min_p - 0.05).abs() > f32::EPSILON { args.push("--min-p".into()); args.push(pc.min_p.to_string()); }
    if (pc.repeat_penalty - 1.0).abs() > f32::EPSILON { args.push("--repeat-penalty".into()); args.push(pc.repeat_penalty.to_string()); }
    if pc.repeat_last_n != 64 { args.push("--repeat-last-n".into()); args.push(pc.repeat_last_n.to_string()); }
    if pc.presence_penalty > f32::EPSILON { args.push("--presence-penalty".into()); args.push(pc.presence_penalty.to_string()); }
    if pc.frequency_penalty > f32::EPSILON { args.push("--frequency-penalty".into()); args.push(pc.frequency_penalty.to_string()); }
    if pc.seed != -1 { args.push("-s".into()); args.push(pc.seed.to_string()); }

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
    args
}

async fn get_llama_binary(config: &AppConfig) -> Result<String, String> {
    let binary_path = config.llama_binary_path.clone();

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
