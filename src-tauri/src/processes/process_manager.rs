use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;
use std::time::SystemTime;

use anyhow::{Context, Result};
use parking_lot::Mutex;
use tokio::process::Command as AsyncCommand;

use crate::domain::*;
use crate::log_info;

pub use super::port_allocator::PortAllocator;
pub use super::process_metrics::ProcessMetrics;

#[derive(Debug)]
pub struct ManagedProcess {
    pub id: String,
    pub model_id: String,
    pub model_path: String,
    pub child: Option<tokio::process::Child>,
    pub pid: u32,
    pub port: u16,
    pub status: ProcessStatus,
    pub started_at: SystemTime,
    pub config: ProcessConfig,
    pub metrics: ProcessMetrics,
    pub stdout_buffer: Arc<Mutex<Vec<String>>>,
    pub stderr_buffer: Arc<Mutex<Vec<String>>>,
}

pub struct ProcessManager {
    pub processes: Arc<Mutex<HashMap<String, ManagedProcess>>>,
    pub port_allocator: Arc<Mutex<PortAllocator>>,
    llama_binary: parking_lot::RwLock<Option<PathBuf>>,
}

// SAFETY: ProcessManager contains Arc<Mutex<>> and parking_lot::RwLock which are Send.
// tokio::process::Child is Send when the runtime is Send.
unsafe impl Send for ProcessManager {}
unsafe impl Sync for ProcessManager {}

impl Default for ProcessManager {
    fn default() -> Self {
        Self::new()
    }
}

impl ProcessManager {
    pub fn new() -> Self {
        Self {
            processes: Arc::new(Mutex::new(HashMap::with_capacity(32))),
            port_allocator: Arc::new(Mutex::new(PortAllocator::new(8080, 9000))),
            llama_binary: parking_lot::RwLock::new(None),
        }
    }

    pub async fn set_llama_binary(&self, path: PathBuf) {
        *self.llama_binary.write() = Some(path);
    }

    pub async fn get_llama_binary(&self) -> Result<PathBuf> {
        if let Some(path) = self.llama_binary.read().as_ref() {
            if path.exists() {
                return Ok(path.clone());
            }
        }

        let binary_name = if cfg!(target_os = "windows") {
            "llama-server.exe"
        } else {
            "llama-server"
        };

        if let Ok(output) = std::process::Command::new("where").arg(binary_name).output() {
            let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
            if !path.is_empty() {
                let path_buf = PathBuf::from(path);
                *self.llama_binary.write() = Some(path_buf.clone());
                return Ok(path_buf);
            }
        }

        let common_paths = vec![
            "./llama-server",
            "./llama.cpp/llama-server",
            "../llama.cpp/llama-server",
        ];

        for path in common_paths {
            let expanded = shellexpand::tilde(path).to_string();
            let path_buf = PathBuf::from(expanded);
            if path_buf.exists() {
                *self.llama_binary.write() = Some(path_buf.clone());
                return Ok(path_buf);
            }
        }

        Err(anyhow::anyhow!("llama-server not found. Please install llama.cpp or set path in settings."))
    }

    pub async fn start_model(
        &self,
        model_id: String,
        model_path: PathBuf,
        config: ProcessConfig,
    ) -> Result<ProcessInfo> {
        let binary = self.get_llama_binary().await?;

        let port = {
            let mut allocator = self.port_allocator.lock();
            allocator.allocate().ok_or_else(|| anyhow::anyhow!("No available ports"))?
        };

        let mut args = vec![
            "-m".to_string(), model_path.to_string_lossy().to_string(),
            "-c".to_string(), config.context_size.to_string(),
            "-ngl".to_string(), config.gpu_layers.to_string(),
            "-t".to_string(), config.threads.to_string(),
            "-b".to_string(), config.batch_size.to_string(),
            "-ub".to_string(), config.ubatch_size.to_string(),
            "--port".to_string(), port.to_string(),
            "--host".to_string(), "127.0.0.1".to_string(),
            "--ctx-size".to_string(), config.context_size.to_string(),
        ];

        if config.flash_attn { args.push("-fa".to_string()); }
        if config.no_mmap { args.push("--no-mmap".to_string()); }
        if config.no_mlock { args.push("--no-mlock".to_string()); }
        if config.numa { args.push("--numa".to_string()); }

        args.extend(config.arguments.clone());

        log_info!(&format!("Starting llama-server on port {} with model {}", port, model_path.display()), "processes");

        let child = AsyncCommand::new(&binary)
            .args(&args)
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped())
            .spawn()
            .context("Failed to spawn llama-server")?;

        let pid = child.id().unwrap_or(0);

        let process_id = uuid::Uuid::new_v4().to_string();
        let now = SystemTime::now();

        let managed = ManagedProcess {
            id: process_id.clone(),
            model_id: model_id.clone(),
            model_path: model_path.to_string_lossy().to_string(),
            child: Some(child),
            pid,
            port,
            status: ProcessStatus::Starting,
            started_at: now,
            config: config.clone(),
            metrics: ProcessMetrics::default(),
            stdout_buffer: Arc::new(Mutex::new(Vec::new())),
            stderr_buffer: Arc::new(Mutex::new(Vec::new())),
        };

        self.spawn_monitors(process_id.clone(), managed.pid);

        let info = ProcessInfo {
            id: process_id.clone(),
            model_id,
            pid: Some(pid),
            port,
            status: ProcessStatus::Starting,
            started_at: now.duration_since(SystemTime::UNIX_EPOCH).unwrap().as_secs(),
            gpu_memory: 0.0,
            cpu_memory: 0.0,
            tokens_per_sec: 0.0,
            context_used: 0,
        };

        self.processes.lock().insert(process_id, managed);

        Ok(info)
    }
}
