use std::time::{Duration, SystemTime};

use tauri::AppHandle;

use crate::application::AppState;
use crate::domain::{ProcessInfo, ProcessMetrics, ProcessStatus};

#[tauri::command]
pub async fn stop_model(
    state: tauri::State<'_, AppState>,
    id: String,
) -> Result<(), String> {
    let pid = {
        let mut registry = state.process_registry.lock().unwrap();
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
        let mut registry = state.process_registry.lock().unwrap();
        if let Some(proc) = registry.get_mut(&id) {
            proc.status = ProcessStatus::Stopped;
            proc.pid = None;
        }
    }

    Ok(())
}

#[tauri::command]
pub async fn restart_model(
    state: tauri::State<'_, AppState>,
    app: AppHandle,
    id: String,
) -> Result<ProcessInfo, String> {
    let (model_id, config) = {
        let registry = state.process_registry.lock().unwrap();
        let proc = registry.get(&id).ok_or("Process not found")?;
        (proc.model_id.clone(), proc.config.clone())
    };

    stop_model(state.clone(), id).await?;
    tokio::time::sleep(Duration::from_millis(500)).await;
    
    let _model = {
        let cache = state.model_cache.lock().unwrap();
        cache.get(&model_id).cloned().ok_or("Model not found")?
    };

    crate::presentation::process_start::start_model(state, app, model_id, Some(config)).await
}

#[tauri::command]
pub async fn get_process_status(
    state: tauri::State<'_, AppState>,
    id: String,
) -> Result<Option<ProcessInfo>, String> {
    let registry = state.process_registry.lock().unwrap();
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
pub async fn list_processes(
    state: tauri::State<'_, AppState>,
) -> Result<Vec<ProcessInfo>, String> {
    let registry = state.process_registry.lock().unwrap();
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
pub async fn get_process_metrics(
    state: tauri::State<'_, AppState>,
    id: String,
) -> Result<Option<ProcessMetrics>, String> {
    let registry = state.process_registry.lock().unwrap();
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
pub async fn get_process_stdout(
    state: tauri::State<'_, AppState>,
    id: String,
    lines: Option<usize>,
) -> Result<Vec<String>, String> {
    let n = lines.unwrap_or(200);
    Ok(state.process_manager.get_stdout(&id, n))
}
