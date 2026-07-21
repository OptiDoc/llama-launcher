use std::collections::HashMap;
use std::time::SystemTime;

use serde::{Deserialize, Serialize};
use sysinfo::{Pid, System};

use crate::domain::ProcessStatus;
use crate::log_warn;

use super::process_manager::ProcessManager;

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

impl ProcessManager {
    pub fn get_metrics(&self, process_id: &str) -> Option<ProcessMetrics> {
        self.processes.lock().get(process_id).map(|p| p.metrics.clone())
    }

    pub fn update_metrics(&self) {
        let mut sys = System::new_all();
        sys.refresh_all();

        let gpu_mem_map = self.query_gpu_memory_per_pid();

        let mut procs = self.processes.lock();
        for proc in procs.values_mut() {
            if proc.pid > 0 && matches!(proc.status, ProcessStatus::Running | ProcessStatus::Starting) {
                if let Some(sys_proc) = sys.process(Pid::from_u32(proc.pid)) {
                    proc.metrics.cpu_memory_mb = sys_proc.memory() as f64 / 1024.0 / 1024.0;
                    proc.metrics.cpu_percent = sys_proc.cpu_usage();
                    proc.metrics.gpu_memory_mb = gpu_mem_map.get(&proc.pid).copied().unwrap_or(0.0);
                    proc.metrics.last_update = SystemTime::now()
                        .duration_since(SystemTime::UNIX_EPOCH)
                        .unwrap()
                        .as_secs();
                } else {
                    log_warn!(&format!("Process {} (pid {}) no longer exists — marking as crashed", proc.id, proc.pid), "processes");
                    proc.status = ProcessStatus::Crashed;
                    proc.pid = 0;
                    self.port_allocator.lock().release(proc.port);
                }
            }
        }
    }

    /// Query nvidia-smi for per-PID GPU memory usage.
    /// Returns a map of PID → GPU memory in MB.
    fn query_gpu_memory_per_pid(&self) -> HashMap<u32, f64> {
        let mut map = HashMap::new();
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
}
