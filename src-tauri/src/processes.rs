use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;
use std::time::{Duration, SystemTime};

use anyhow::{Context, Result};
use once_cell::sync::Lazy;
use parking_lot::Mutex;
use serde::{Deserialize, Serialize};
use sysinfo::{Pid, System};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command as AsyncCommand;
use tracing::{debug, info, warn};

use crate::core::*;

pub struct ProcessManager {
    processes: Arc<Mutex<HashMap<String, ManagedProcess>>>,
    port_allocator: Arc<Mutex<PortAllocator>>,
    llama_binary: parking_lot::RwLock<Option<PathBuf>>,
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

        info!("Starting llama-server on port {} with model {}", port, model_path.display());

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

    fn spawn_monitors(&self, process_id: String, _pid: u32) {
        let processes = self.processes.clone();

        if let Some(mut child) = {
            let mut procs = self.processes.lock();
            procs.get_mut(&process_id).and_then(|p| p.child.take())
        } {
            let stdout = child.stdout.take();
            let stderr = child.stderr.take();
            let proc_id = process_id.clone();
            let processes_clone = processes.clone();

            tokio::spawn(async move {
                if let Some(stdout) = stdout {
                    let mut reader = BufReader::new(stdout).lines();
                    while let Ok(Some(line)) = reader.next_line().await {
                        debug!("[{}] stdout: {}", proc_id, line);

                        if line.contains("tokens per second") || line.contains("t/s") {
                            if let Some(tps) = parse_tokens_per_sec(&line) {
                                if let Some(proc) = processes_clone.lock().get_mut(&proc_id) {
                                    proc.metrics.tokens_per_sec = tps;
                                }
                            }
                        }

                        if let Some(proc) = processes_clone.lock().get_mut(&proc_id) {
                            proc.stdout_buffer.lock().push(line);
                            if proc.stdout_buffer.lock().len() > 1000 {
                                proc.stdout_buffer.lock().drain(0..500);
                            }
                        }
                    }
                }
            });

            let proc_id = process_id.clone();
            let processes_clone = processes.clone();

            tokio::spawn(async move {
                if let Some(stderr) = stderr {
                    let mut reader = BufReader::new(stderr).lines();
                    while let Ok(Some(line)) = reader.next_line().await {
                        warn!("[{}] stderr: {}", proc_id, line);

                        if let Some(proc) = processes_clone.lock().get_mut(&proc_id) {
                            proc.stderr_buffer.lock().push(line);
                            if proc.stderr_buffer.lock().len() > 1000 {
                                proc.stderr_buffer.lock().drain(0..500);
                            }
                        }
                    }
                }
            });

            let proc_id = process_id;
            tokio::spawn(async move {
                let status = child.wait().await;
                let mut procs = processes.lock();
                if let Some(proc) = procs.get_mut(&proc_id) {
                    proc.status = match status {
                        Ok(s) if s.success() => ProcessStatus::Stopped,
                        Ok(_) => ProcessStatus::Crashed,
                        Err(_) => ProcessStatus::Error,
                    };
                    proc.child = None;
                    proc.pid = 0;
                }
            });
        }
    }

    pub async fn stop_model(&self, process_id: &str) -> Result<()> {
        let mut procs = self.processes.lock();
        if let Some(proc) = procs.get_mut(process_id) {
            proc.status = ProcessStatus::Stopping;

            if let Some(pid) = Some(proc.pid).filter(|&p| p > 0) {
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
            proc.pid = 0;

            self.port_allocator.lock().release(proc.port);
        }
        Ok(())
    }

    pub async fn restart_model(&self, process_id: &str) -> Result<ProcessInfo> {
        let (model_id, model_path, config) = {
            let procs = self.processes.lock();
            let proc = procs.get(process_id)
                .ok_or_else(|| anyhow::anyhow!("Process not found"))?;
            (proc.model_id.clone(), proc.model_path.clone(), proc.config.clone())
        };

        self.stop_model(process_id).await?;
        tokio::time::sleep(Duration::from_millis(500)).await;

        self.start_model(model_id, PathBuf::from(model_path), config).await
    }

    pub fn get_process(&self, process_id: &str) -> Option<ProcessInfo> {
        let procs = self.processes.lock();
        procs.get(process_id).map(|p| ProcessInfo {
            id: p.id.clone(),
            model_id: p.model_id.clone(),
            pid: if p.pid > 0 { Some(p.pid) } else { None },
            port: p.port,
            status: p.status,
            started_at: p.started_at.duration_since(SystemTime::UNIX_EPOCH).unwrap().as_secs(),
            gpu_memory: p.metrics.gpu_memory_mb,
            cpu_memory: p.metrics.cpu_memory_mb,
            tokens_per_sec: p.metrics.tokens_per_sec,
            context_used: p.metrics.context_used,
        })
    }

    pub fn list_processes(&self) -> Vec<ProcessInfo> {
        let procs = self.processes.lock();
        procs.values().map(|p| ProcessInfo {
            id: p.id.clone(),
            model_id: p.model_id.clone(),
            pid: if p.pid > 0 { Some(p.pid) } else { None },
            port: p.port,
            status: p.status,
            started_at: p.started_at.duration_since(SystemTime::UNIX_EPOCH).unwrap().as_secs(),
            gpu_memory: p.metrics.gpu_memory_mb,
            cpu_memory: p.metrics.cpu_memory_mb,
            tokens_per_sec: p.metrics.tokens_per_sec,
            context_used: p.metrics.context_used,
        }).collect()
    }

    pub fn get_metrics(&self, process_id: &str) -> Option<ProcessMetrics> {
        self.processes.lock().get(process_id).map(|p| p.metrics.clone())
    }

    pub fn update_metrics(&self) {
        let mut sys = System::new_all();
        sys.refresh_all();

        // Query nvidia-smi for per-process GPU memory usage
        let gpu_mem_map = self.query_gpu_memory_per_pid();

        let mut procs = self.processes.lock();
        for (_, proc) in procs.iter_mut() {
            if proc.pid > 0 && matches!(proc.status, ProcessStatus::Running | ProcessStatus::Starting) {
                if let Some(sys_proc) = sys.process(Pid::from_u32(proc.pid)) {
                    proc.metrics.cpu_memory_mb = sys_proc.memory() as f64 / 1024.0 / 1024.0;
                    proc.metrics.cpu_percent = sys_proc.cpu_usage();
                    // GPU memory from nvidia-smi (if available)
                    proc.metrics.gpu_memory_mb = gpu_mem_map.get(&proc.pid).copied().unwrap_or(0.0);
                    proc.metrics.last_update = SystemTime::now()
                        .duration_since(SystemTime::UNIX_EPOCH)
                        .unwrap()
                        .as_secs();
                } else {
                    proc.status = ProcessStatus::Crashed;
                    proc.pid = 0;
                    self.port_allocator.lock().release(proc.port);
                }
            }
        }
    }

    /// Query nvidia-smi for per-PID GPU memory usage.
    /// Returns a map of PID → GPU memory in MB.
    fn query_gpu_memory_per_pid(&self) -> std::collections::HashMap<u32, f64> {
        let mut map = std::collections::HashMap::new();
        let output = std::process::Command::new("nvidia-smi")
            .args(["--query-compute-apps=pid,used_memory", "--format=csv,noheader,nounits"])
            .output();
        if let Ok(out) = output {
            if out.status.success() {
                let stdout = String::from_utf8_lossy(&out.stdout);
                for line in stdout.lines() {
                    let parts: Vec<&str> = line.split(',').map(|s| s.trim()).collect();
                    if parts.len() >= 2 {
                        if let (Ok(pid), Ok(mem)) = (parts[0].parse::<u32>(), parts[1].parse::<f64>()) {
                            map.insert(pid, mem);
                        }
                    }
                }
            }
        }
        map
    }

    pub fn cleanup(&self) {
        let mut procs = self.processes.lock();
        let mut dead = Vec::new();

        for (id, proc) in procs.iter() {
            if matches!(proc.status, ProcessStatus::Stopped | ProcessStatus::Crashed | ProcessStatus::Error) {
                dead.push(id.clone());
            }
        }

        for id in dead {
            if let Some(proc) = procs.remove(&id) {
                self.port_allocator.lock().release(proc.port);
            }
        }
    }

    pub fn get_stdout(&self, process_id: &str, lines: usize) -> Vec<String> {
        self.processes.lock()
            .get(process_id)
            .map(|p| {
                let buf = p.stdout_buffer.lock();
                buf.iter().rev().take(lines).cloned().collect()
            })
            .unwrap_or_default()
    }

    pub fn get_stderr(&self, process_id: &str, lines: usize) -> Vec<String> {
        self.processes.lock()
            .get(process_id)
            .map(|p| {
                let buf = p.stderr_buffer.lock();
                buf.iter().rev().take(lines).cloned().collect()
            })
            .unwrap_or_default()
    }
}

#[derive(Debug)]
struct ManagedProcess {
    id: String,
    model_id: String,
    model_path: String,
    child: Option<tokio::process::Child>,
    pid: u32,
    port: u16,
    status: ProcessStatus,
    started_at: SystemTime,
    config: ProcessConfig,
    metrics: ProcessMetrics,
    stdout_buffer: Arc<Mutex<Vec<String>>>,
    stderr_buffer: Arc<Mutex<Vec<String>>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessMetrics {
    pub cpu_percent: f32,
    pub cpu_memory_mb: f64,
    pub gpu_memory_mb: f64,
    pub tokens_per_sec: f32,
    pub prompt_tokens: u64,
    pub completion_tokens: u64,
    pub total_tokens: u64,
    pub avg_latency_ms: f32,
    pub context_used: usize,
    pub kv_cache_mb: f64,
    pub last_update: u64,
}

impl Default for ProcessMetrics {
    fn default() -> Self {
        Self {
            cpu_percent: 0.0,
            cpu_memory_mb: 0.0,
            gpu_memory_mb: 0.0,
            tokens_per_sec: 0.0,
            prompt_tokens: 0,
            completion_tokens: 0,
            total_tokens: 0,
            avg_latency_ms: 0.0,
            context_used: 0,
            kv_cache_mb: 0.0,
            last_update: 0,
        }
    }
}

fn parse_tokens_per_sec(line: &str) -> Option<f32> {
    let line = line.to_lowercase();

    if let Some(idx) = line.find("tokens per second") {
        let before = &line[..idx];
        if let Some(num) = before.split_whitespace().last() {
            return num.parse().ok();
        }
    }

    if let Some(idx) = line.find("t/s") {
        let before = &line[..idx];
        if let Some(num) = before.split_whitespace().last() {
            return num.parse().ok();
        }
    }

    None
}

#[derive(Debug)]
pub struct PortAllocator {
    used: std::collections::HashSet<u16>,
    range: std::ops::Range<u16>,
}

impl PortAllocator {
    pub fn new(start: u16, end: u16) -> Self {
        Self {
            used: std::collections::HashSet::new(),
            range: start..end,
        }
    }

    pub fn allocate(&mut self) -> Option<u16> {
        for port in self.range.clone() {
            if !self.used.contains(&port) && Self::is_port_free(port) {
                self.used.insert(port);
                return Some(port);
            }
        }
        None
    }

    pub fn release(&mut self, port: u16) {
        self.used.remove(&port);
    }

    fn is_port_free(port: u16) -> bool {
        std::net::TcpListener::bind(("127.0.0.1", port)).is_ok()
    }
}

pub struct BenchmarkRunner {
    manager: Arc<ProcessManager>,
}

impl BenchmarkRunner {
    pub fn new(manager: Arc<ProcessManager>) -> Self {
        Self { manager }
    }

    pub async fn run(&self, config: BenchmarkConfig) -> Result<BenchmarkResult> {
        let id = uuid::Uuid::new_v4().to_string();
        let model_id = config.model_id.clone();

        let process_config = ProcessConfig {
            context_size: config.context_size,
            gpu_layers: config.n_gpu_layers,
            threads: config.n_threads,
            batch_size: config.batch_size,
            ubatch_size: config.batch_size,
            flash_attn: true,
            no_mmap: false,
            no_mlock: false,
            numa: false,
            arguments: vec!["--embedding".to_string()],
        };

        let process_info = self.manager.start_model(
            model_id.clone(),
            config.model_path.clone(),
            process_config,
        ).await?;

        tokio::time::sleep(Duration::from_secs(3)).await;

        let mut results = Vec::new();

        for _ in 0..config.warmup_runs {
            self.run_single_inference(&process_info, &config).await?;
        }

        for _ in 0..config.runs {
            let result = self.run_single_inference(&process_info, &config).await?;
            results.push(result);
        }

        self.manager.stop_model(&process_info.id).await?;

        let tokens_per_sec: Vec<f32> = results.iter().map(|r| r.tokens_per_sec).collect();
        let latencies: Vec<f32> = results.iter().map(|r| r.latency_ms).collect();

        let avg_tps = tokens_per_sec.iter().sum::<f32>() / tokens_per_sec.len() as f32;
        let min_tps = tokens_per_sec.iter().fold(f32::INFINITY, |a, &b| a.min(b));
        let max_tps = tokens_per_sec.iter().fold(f32::NEG_INFINITY, |a, &b| a.max(b));

        let mut sorted_latencies = latencies.clone();
        sorted_latencies.sort_by(|a, b| a.partial_cmp(b).unwrap());

        let avg_latency = latencies.iter().sum::<f32>() / latencies.len() as f32;
        let p50 = sorted_latencies[sorted_latencies.len() / 2];
        let p95 = sorted_latencies[(sorted_latencies.len() as f64 * 0.95) as usize];
        let p99 = sorted_latencies[(sorted_latencies.len() as f64 * 0.99) as usize];

        Ok(BenchmarkResult {
            id,
            model_id,
            timestamp: SystemTime::now(),
            config,
            results: BenchmarkMetrics {
                avg_tokens_per_sec: avg_tps,
                min_tokens_per_sec: min_tps,
                max_tokens_per_sec: max_tps,
                avg_latency_ms: avg_latency,
                p50_latency_ms: p50,
                p95_latency_ms: p95,
                p99_latency_ms: p99,
                memory_used_mb: 0.0,
                gpu_memory_used_mb: 0.0,
                power_watts: None,
            },
        })
    }

    async fn run_single_inference(&self, process: &ProcessInfo, config: &BenchmarkConfig) -> Result<InferenceResult> {
        let client = reqwest::Client::new();
        let url = format!("http://127.0.0.1:{}/completion", process.port);

        let start = std::time::Instant::now();

        let response = client.post(&url)
            .json(&serde_json::json!({
                "prompt": config.prompt,
                "n_predict": config.n_predict,
                "temperature": 0.7,
                "top_p": 0.9,
                "stream": false,
            }))
            .send()
            .await?;

        let latency = start.elapsed().as_millis() as f32;

        let json: serde_json::Value = response.json().await?;
        let tokens = json["tokens_predicted"].as_u64().unwrap_or(0) as usize;
        let tps = tokens as f32 / (latency / 1000.0);

        Ok(InferenceResult {
            tokens_per_sec: tps,
            latency_ms: latency,
            tokens_predicted: tokens,
        })
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BenchmarkConfig {
    pub model_id: String,
    pub model_path: PathBuf,
    pub prompt: String,
    pub n_predict: usize,
    pub n_threads: usize,
    pub n_gpu_layers: i32,
    pub batch_size: usize,
    pub context_size: usize,
    pub runs: usize,
    pub warmup_runs: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BenchmarkResult {
    pub id: String,
    pub model_id: String,
    pub timestamp: SystemTime,
    pub config: BenchmarkConfig,
    pub results: BenchmarkMetrics,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BenchmarkMetrics {
    pub avg_tokens_per_sec: f32,
    pub min_tokens_per_sec: f32,
    pub max_tokens_per_sec: f32,
    pub avg_latency_ms: f32,
    pub p50_latency_ms: f32,
    pub p95_latency_ms: f32,
    pub p99_latency_ms: f32,
    pub memory_used_mb: f64,
    pub gpu_memory_used_mb: f64,
    pub power_watts: Option<f32>,
}

#[derive(Debug, Clone)]
struct InferenceResult {
    tokens_per_sec: f32,
    latency_ms: f32,
    #[allow(dead_code)]
    tokens_predicted: usize,
}

static PROCESS_MANAGER: Lazy<ProcessManager> = Lazy::new(ProcessManager::new);

pub fn process_manager() -> &'static ProcessManager {
    &PROCESS_MANAGER
}
