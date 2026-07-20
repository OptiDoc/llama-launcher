use std::collections::HashMap;
use std::time::SystemTime;

use serde::{Deserialize, Serialize};

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

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct ProcessConfig {
    pub context_size: usize,
    pub gpu_layers: i32,
    pub threads: usize,
    pub batch_size: usize,
    pub ubatch_size: usize,
    pub flash_attn: bool,
    pub no_mmap: bool,
    pub no_mlock: bool,
    pub numa: bool,
    pub port: u16,
    pub host: String,
    pub parallel: i32,
    pub cont_batching: bool,
    pub n_predict: i32,
    pub timeout: u32,
    pub metrics: bool,
    pub api_key: String,
    pub threads_batch: i32,
    pub cache_type_k: String,
    pub cache_type_v: String,
    pub split_mode: String,
    pub tensor_split: String,
    pub main_gpu: i32,
    pub kv_offload: bool,
    pub fit: bool,
    pub temperature: f32,
    pub top_k: i32,
    pub top_p: f32,
    pub min_p: f32,
    pub repeat_penalty: f32,
    pub repeat_last_n: i32,
    pub presence_penalty: f32,
    pub frequency_penalty: f32,
    pub seed: i32,
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

#[derive(Debug)]
pub struct ProcessRegistry {
    processes: HashMap<String, RunningProcess>,
    next_id: u64,
}

impl Default for ProcessRegistry {
    fn default() -> Self {
        Self::new()
    }
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
