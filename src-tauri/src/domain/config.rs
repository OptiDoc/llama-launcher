use serde::{Deserialize, Serialize};

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
