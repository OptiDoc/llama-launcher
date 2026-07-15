use std::collections::HashMap;
use std::sync::atomic::AtomicBool;
use std::sync::Arc;
use std::sync::Mutex as StdMutex;
use std::time::{Duration, Instant, SystemTime};

use once_cell::sync::Lazy;
use parking_lot::RwLock;
use serde::{Deserialize, Serialize};
use sysinfo::System;
use tracing::info;

pub static GLOBAL_STATE: Lazy<GlobalState> = Lazy::new(|| {
    info!("[core] Initializing GLOBAL_STATE");
    GlobalState::new()
});

pub struct GlobalState {
    pub process_registry: StdMutex<ProcessRegistry>,
    pub system_monitor: StdMutex<SystemMonitor>,
    pub config: RwLock<AppConfig>,
    pub model_cache: StdMutex<HashMap<String, ModelInfo>>,
    pub benchmark_results: StdMutex<Vec<BenchmarkResult>>,
    pub cancel_tokens: StdMutex<HashMap<String, Arc<AtomicBool>>>,
}

impl GlobalState {
    pub fn new() -> Self {
        info!("[core] Creating GlobalState");
        Self {
            process_registry: StdMutex::new(ProcessRegistry::new()),
            system_monitor: StdMutex::new(SystemMonitor::new()),
            config: RwLock::new(AppConfig::default()),
            model_cache: StdMutex::new(HashMap::new()),
            benchmark_results: StdMutex::new(Vec::new()),
            cancel_tokens: StdMutex::new(HashMap::new()),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    pub llama_binary_path: Option<String>,
    pub models_directory: String,
    pub cuda_libs_dir: String,
    pub default_context_size: usize,
    pub default_gpu_layers: i32,
    pub default_threads: usize,
    pub default_batch_size: usize,
    pub ubatch_size: usize,
    pub flash_attn: bool,
    pub no_mmap: bool,
    pub no_mlock: bool,
    pub numa: bool,
    pub auto_start_server: bool,
    pub server_port: u16,
    pub enable_gpu: bool,
    pub gpu_device: Option<i32>,
    pub enable_metal: bool,
    pub enable_cuda: bool,
    pub enable_vulkan: bool,
    pub enable_opencl: bool,
    pub log_level: String,
    pub telemetry_enabled: bool,
    pub check_updates: bool,
    pub minimize_to_tray: bool,
    pub start_minimized: bool,
    pub theme: Theme,
    pub language: String,
}

impl Default for AppConfig {
    fn default() -> Self {
        let models_dir = std::env::var("HOME")
            .or_else(|_| std::env::var("USERPROFILE"))
            .map(|p| std::path::PathBuf::from(p).join(".llama-launcher").join("models"))
            .unwrap_or_else(|_| std::path::PathBuf::from("./models"))
            .to_string_lossy()
            .to_string();

        Self {
            llama_binary_path: None,
            models_directory: models_dir.clone(),
            cuda_libs_dir: models_dir.replace("/models", "/cuda").replace("\\models", "\\cuda"),
            default_context_size: 8192,
            default_gpu_layers: -1,
            default_threads: num_cpus::get(),
            default_batch_size: 512,
            ubatch_size: 512,
            flash_attn: true,
            no_mmap: false,
            no_mlock: false,
            numa: false,
            auto_start_server: false,
            server_port: 8080,
            enable_gpu: true,
            gpu_device: None,
            enable_metal: cfg!(target_os = "macos"),
            enable_cuda: cfg!(target_os = "windows") || cfg!(target_os = "linux"),
            enable_vulkan: false,
            enable_opencl: false,
            log_level: "info".to_string(),
            telemetry_enabled: false,
            check_updates: true,
            minimize_to_tray: true,
            start_minimized: false,
            theme: Theme::System,
            language: "en".to_string(),
        }
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum Theme {
    Light,
    Dark,
    System,
}

#[derive(Debug)]
pub struct ProcessRegistry {
    processes: HashMap<String, RunningProcess>,
    next_id: u64,
}

impl ProcessRegistry {
    pub fn new() -> Self {
        Self {
            processes: HashMap::new(),
            next_id: 1,
        }
    }

    pub fn add(&mut self, process: RunningProcess) -> String {
        let id = format!("proc_{}", self.next_id);
        self.next_id += 1;
        self.processes.insert(id.clone(), process);
        id
    }

    pub fn remove(&mut self, id: &str) -> Option<RunningProcess> {
        self.processes.remove(id)
    }

    pub fn get(&self, id: &str) -> Option<&RunningProcess> {
        self.processes.get(id)
    }

    pub fn get_mut(&mut self, id: &str) -> Option<&mut RunningProcess> {
        self.processes.get_mut(id)
    }

    pub fn list(&self) -> Vec<&RunningProcess> {
        self.processes.values().collect()
    }

    pub fn cleanup_dead(&mut self) {
        self.processes.retain(|_, p| p.is_alive());
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RunningProcess {
    pub id: String,
    pub model_id: String,
    pub model_path: String,
    pub pid: Option<u32>,
    pub port: u16,
    pub status: ProcessStatus,
    pub started_at: SystemTime,
    pub config: ProcessConfig,
    pub metrics: ProcessMetrics,
}

impl RunningProcess {
    pub fn is_alive(&self) -> bool {
        matches!(self.status, ProcessStatus::Starting | ProcessStatus::Running)
            && self.pid.is_some()
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum ProcessStatus {
    Starting,
    Running,
    Stopping,
    Stopped,
    Crashed,
    Error,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessConfig {
    // Core
    pub context_size: usize,
    pub gpu_layers: i32,
    pub threads: usize,
    pub batch_size: usize,
    pub ubatch_size: usize,
    pub flash_attn: bool,
    pub no_mmap: bool,
    pub no_mlock: bool,
    pub numa: bool,
    // Server
    pub port: u16,
    pub host: String,
    pub parallel: i32,          // -1 = auto
    pub cont_batching: bool,
    pub n_predict: i32,         // -1 = infinity
    pub timeout: u32,           // seconds
    pub metrics: bool,
    pub api_key: String,
    // Performance
    pub threads_batch: i32,     // -1 = same as threads
    pub cache_type_k: String,
    pub cache_type_v: String,
    pub split_mode: String,     // none/layer/row/tensor
    pub tensor_split: String,   // comma-separated
    pub main_gpu: i32,
    pub kv_offload: bool,
    pub fit: bool,
    // Sampling
    pub temperature: f32,
    pub top_k: i32,
    pub top_p: f32,
    pub min_p: f32,
    pub repeat_penalty: f32,
    pub repeat_last_n: i32,
    pub presence_penalty: f32,
    pub frequency_penalty: f32,
    pub seed: i32,
    // Advanced
    pub lora: String,
    pub mmproj: String,
    pub jinja: bool,
    pub reasoning_format: String,
    pub reasoning_budget: i32,
    pub chat_template: String,
    pub rope_scaling: String,
    pub rope_scale: f32,
    pub rope_freq_base: f32,
    pub rope_freq_scale: f32,
    pub grammar: String,
    pub json_schema: String,
    pub log_level: i32,
    pub arguments: Vec<String>,
}

impl Default for ProcessConfig {
    fn default() -> Self {
        let config = GLOBAL_STATE.config.read();
        Self {
            context_size: config.default_context_size,
            gpu_layers: config.default_gpu_layers,
            threads: config.default_threads,
            batch_size: config.default_batch_size,
            ubatch_size: config.ubatch_size,
            flash_attn: config.flash_attn,
            no_mmap: config.no_mmap,
            no_mlock: config.no_mlock,
            numa: config.numa,
            // Server
            port: config.server_port,
            host: "127.0.0.1".to_string(),
            parallel: -1,
            cont_batching: true,
            n_predict: -1,
            timeout: 3600,
            metrics: false,
            api_key: String::new(),
            // Performance
            threads_batch: -1,
            cache_type_k: "f16".to_string(),
            cache_type_v: "f16".to_string(),
            split_mode: "layer".to_string(),
            tensor_split: String::new(),
            main_gpu: 0,
            kv_offload: true,
            fit: true,
            // Sampling
            temperature: 0.8,
            top_k: 40,
            top_p: 0.95,
            min_p: 0.05,
            repeat_penalty: 1.1,
            repeat_last_n: 64,
            presence_penalty: 0.0,
            frequency_penalty: 0.0,
            seed: -1,
            // Advanced
            lora: String::new(),
            mmproj: String::new(),
            jinja: true,
            reasoning_format: "auto".to_string(),
            reasoning_budget: -1,
            chat_template: String::new(),
            rope_scaling: String::new(),
            rope_scale: 0.0,
            rope_freq_base: 0.0,
            rope_freq_scale: 0.0,
            grammar: String::new(),
            json_schema: String::new(),
            log_level: 3,
            arguments: Vec::new(),
        }
    }
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
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

#[derive(Debug)]
pub struct SystemMonitor {
    cpu_usage: f32,
    cpu_name: String,
    cpu_cores_physical: usize,
    cpu_cores_logical: usize,
    memory_total: u64,
    memory_used: u64,
    disk_total: u64,
    disk_used: u64,
    os_name: String,
    os_version: String,
    gpu_info: Vec<GpuInfo>,
    last_update: Instant,
    last_gpu_update: Instant,
}

impl Default for SystemMonitor {
    fn default() -> Self {
        Self::new()
    }
}

impl SystemMonitor {
    pub fn new() -> Self {
        let mut sys = System::new_all();
        sys.refresh_all();

        let cpu_name = sys.cpus().first().map(|c| c.brand().to_string()).unwrap_or_default();
        let cpu_cores_physical = sys.cpus().len();
        let cpu_cores_logical = num_cpus::get();

        let (disk_total, disk_used) = Self::get_disk_stats();

        Self {
            cpu_usage: sys.global_cpu_usage(),
            cpu_name,
            cpu_cores_physical,
            cpu_cores_logical,
            memory_total: sys.total_memory(),
            memory_used: sys.used_memory(),
            disk_total,
            disk_used,
            os_name: System::name().unwrap_or_default(),
            os_version: System::os_version().unwrap_or_default(),
            gpu_info: Vec::new(),
            last_update: Instant::now(),
            last_gpu_update: Instant::now() - Duration::from_secs(60),
        }
    }

    fn get_disk_stats() -> (u64, u64) {
        let disk = sysinfo::Disks::new_with_refreshed_list();
        if let Some(d) = disk.iter().next() {
            (d.total_space(), d.total_space() - d.available_space())
        } else {
            (0, 0)
        }
    }

    pub fn update(&mut self) {
        // CPU/RAM every call (cheap)
        let mut sys = System::new_all();
        sys.refresh_all();
        self.cpu_usage = sys.global_cpu_usage();
        self.memory_total = sys.total_memory();
        self.memory_used = sys.used_memory();

        // Disk every 10 seconds
        let now = Instant::now();
        if now.duration_since(self.last_update) > Duration::from_secs(10) || self.disk_total == 0 {
            let (total, used) = Self::get_disk_stats();
            self.disk_total = total;
            self.disk_used = used;
        }
        self.last_update = now;
    }

    pub fn update_gpu(&mut self, gpus: Vec<GpuInfo>) {
        self.gpu_info = gpus;
        self.last_gpu_update = Instant::now();
    }

    pub fn get_stats(&self) -> SystemStats {
        SystemStats {
            cpu_percent: self.cpu_usage,
            cpu_name: self.cpu_name.clone(),
            cpu_cores_physical: self.cpu_cores_physical,
            cpu_cores_logical: self.cpu_cores_logical,
            memory_total_mb: self.memory_total / 1024 / 1024,
            memory_used_mb: self.memory_used / 1024 / 1024,
            memory_available_mb: (self.memory_total - self.memory_used) / 1024 / 1024,
            disk_total_gb: self.disk_total as f64 / (1024.0 * 1024.0 * 1024.0),
            disk_used_gb: self.disk_used as f64 / (1024.0 * 1024.0 * 1024.0),
            disk_free_gb: (self.disk_total - self.disk_used) as f64 / (1024.0 * 1024.0 * 1024.0),
            os_name: self.os_name.clone(),
            os_version: self.os_version.clone(),
            gpu_count: self.gpu_info.len(),
            gpus: self.gpu_info.clone(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemStats {
    pub cpu_percent: f32,
    pub cpu_name: String,
    pub cpu_cores_physical: usize,
    pub cpu_cores_logical: usize,
    pub memory_total_mb: u64,
    pub memory_used_mb: u64,
    pub memory_available_mb: u64,
    pub disk_total_gb: f64,
    pub disk_used_gb: f64,
    pub disk_free_gb: f64,
    pub os_name: String,
    pub os_version: String,
    pub gpu_count: usize,
    pub gpus: Vec<GpuInfo>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GpuInfo {
    pub index: usize,
    pub name: String,
    pub vendor: GpuVendor,
    pub memory_total_mb: u64,
    pub memory_used_mb: u64,
    pub memory_free_mb: u64,
    pub temperature_c: Option<u32>,
    pub utilization_percent: Option<u32>,
    pub compute_capability: Option<String>,
    pub driver_version: Option<String>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum GpuVendor {
    Nvidia,
    Amd,
    Intel,
    Apple,
    Other,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelInfo {
    pub id: String,
    pub name: String,
    pub path: String,
    pub size: u64,
    pub format: ModelFormat,
    pub architecture: Option<String>,
    pub quantization: Option<String>,
    pub context_size: Option<usize>,
    pub parameter_count: Option<String>,
    pub modified: u64,
    pub metadata: ModelMetadata,
    pub checksum: Option<String>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum ModelFormat {
    Gguf,
    Ggml,
    PyTorch,
    Safetensors,
    Onnx,
    TensorRT,
    Other,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct ModelMetadata {
    pub description: Option<String>,
    pub author: Option<String>,
    pub license: Option<String>,
    pub tags: Vec<String>,
    pub model_card: Option<String>,
    pub downloads: Option<u64>,
    pub likes: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BenchmarkResult {
    pub id: String,
    pub model_id: String,
    pub timestamp: u64,
    pub config: BenchmarkConfig,
    pub results: BenchmarkMetrics,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BenchmarkConfig {
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

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessInfo {
    pub id: String,
    pub model_id: String,
    pub pid: Option<u32>,
    pub port: u16,
    pub status: ProcessStatus,
    pub started_at: u64,
    pub gpu_memory: f64,
    pub cpu_memory: f64,
    pub tokens_per_sec: f32,
    pub context_used: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemSnapshot {
    pub cpu_percent: f32,
    pub cpu_name: String,
    pub cpu_cores_physical: usize,
    pub cpu_cores_logical: usize,
    pub memory_total_mb: u64,
    pub memory_used_mb: u64,
    pub memory_available_mb: u64,
    pub disk_total_gb: f64,
    pub disk_used_gb: f64,
    pub disk_free_gb: f64,
    pub os_name: String,
    pub os_version: String,
}

pub fn get_migrations() -> Vec<tauri_plugin_sql::Migration> {
    vec![
        tauri_plugin_sql::Migration {
            version: 1,
            description: "Create models table",
            sql: include_str!("../migrations/001_create_models.sql"),
            kind: tauri_plugin_sql::MigrationKind::Up,
        },
        tauri_plugin_sql::Migration {
            version: 2,
            description: "Create processes table",
            sql: include_str!("../migrations/002_create_benchmarks.sql"),
            kind: tauri_plugin_sql::MigrationKind::Up,
        },
        tauri_plugin_sql::Migration {
            version: 3,
            description: "Create processes table",
            sql: include_str!("../migrations/003_create_processes.sql"),
            kind: tauri_plugin_sql::MigrationKind::Up,
        },
        tauri_plugin_sql::Migration {
            version: 4,
            description: "Add model metadata",
            sql: include_str!("../migrations/004_add_model_metadata.sql"),
            kind: tauri_plugin_sql::MigrationKind::Up,
        },
    ]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_process_registry() {
        let mut registry = ProcessRegistry::new();
        let proc = RunningProcess {
            id: "test".to_string(),
            model_id: "model1".to_string(),
            model_path: "/path/to/model.gguf".to_string(),
            pid: Some(1234),
            port: 8080,
            status: ProcessStatus::Running,
            started_at: SystemTime::now(),
            config: ProcessConfig::default(),
            metrics: ProcessMetrics::default(),
        };
        let id = registry.add(proc);
        assert!(!id.is_empty());
        assert!(registry.get(&id).is_some());
    }
}
