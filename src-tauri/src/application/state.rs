use std::collections::HashMap;
use std::sync::atomic::AtomicBool;
use std::sync::Arc;
use std::sync::Mutex as StdMutex;
use std::time::{Duration, Instant};

use parking_lot::RwLock;
use sysinfo::System;

use crate::domain::*;

pub struct AppState {
    pub process_registry: StdMutex<ProcessRegistry>,
    pub system_monitor: StdMutex<CoreSystemMonitor>,
    pub config: RwLock<AppConfig>,
    pub model_cache: StdMutex<HashMap<String, ModelInfo>>,
    pub benchmark_results: StdMutex<Vec<BenchmarkResult>>,
    pub cancel_tokens: StdMutex<HashMap<String, Arc<AtomicBool>>>,
    pub process_manager: Arc<crate::processes::ProcessManager>,
}

impl AppState {
    pub fn new() -> Self {
        crate::log_info!("[app] Creating AppState", "app");
        Self {
            process_registry: StdMutex::new(ProcessRegistry::new()),
            system_monitor: StdMutex::new(CoreSystemMonitor::new()),
            config: RwLock::new(AppConfig::default()),
            model_cache: StdMutex::new(HashMap::new()),
            benchmark_results: StdMutex::new(Vec::new()),
            cancel_tokens: StdMutex::new(HashMap::new()),
            process_manager: Arc::new(crate::processes::ProcessManager::new()),
        }
    }
}

pub struct CoreSystemMonitor {
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

impl CoreSystemMonitor {
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
        let mut sys = System::new_all();
        sys.refresh_all();
        self.cpu_usage = sys.global_cpu_usage();
        self.memory_total = sys.total_memory();
        self.memory_used = sys.used_memory();
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
