use std::sync::Arc;
use std::time::SystemTime;

use anyhow::Result;
use parking_lot::Mutex;
use serde::{Deserialize, Serialize};
use sysinfo::System;

use crate::core::GpuVendor;

pub struct SystemMonitor {
    sys: Arc<Mutex<System>>,
    last_update: Mutex<SystemTime>,
    cpu_history: Arc<Mutex<Vec<f32>>>,
    memory_history: Arc<Mutex<Vec<(u64, u64)>>>,
}

impl SystemMonitor {
    pub fn new() -> Self {
        let mut sys = System::new_all();
        sys.refresh_all();

        Self {
            sys: Arc::new(Mutex::new(sys)),
            last_update: Mutex::new(SystemTime::now()),
            cpu_history: Arc::new(Mutex::new(Vec::with_capacity(60))),
            memory_history: Arc::new(Mutex::new(Vec::with_capacity(60))),
        }
    }

    pub fn update(&self) {
        let mut sys = self.sys.lock();
        sys.refresh_all();

        let cpu = sys.global_cpu_usage();
        let mem_used = sys.used_memory();
        let mem_total = sys.total_memory();

        let mut cpu_hist = self.cpu_history.lock();
        cpu_hist.push(cpu);
        if cpu_hist.len() > 60 {
            let excess = cpu_hist.len() - 60;
            cpu_hist.drain(0..excess);
        }

        let mut mem_hist = self.memory_history.lock();
        mem_hist.push((mem_used, mem_total));
        if mem_hist.len() > 60 {
            let excess = mem_hist.len() - 60;
            mem_hist.drain(0..excess);
        }

        *self.last_update.lock() = SystemTime::now();
    }

    pub fn get_snapshot(&self) -> SystemSnapshot {
        let sys = self.sys.lock();

        let cpu_percent = sys.global_cpu_usage();
        let memory_total = sys.total_memory();
        let memory_used = sys.used_memory();
        let memory_available = memory_total - memory_used;

        let cpu_cores: Vec<CpuCoreInfo> = sys.cpus().iter().map(|c| CpuCoreInfo {
            name: c.name().to_string(),
            usage: c.cpu_usage(),
            frequency: c.frequency(),
        }).collect();

        SystemSnapshot {
            cpu_percent,
            cpu_cores,
            memory_total,
            memory_used,
            memory_available,
            swap_total: sys.total_swap(),
            swap_used: sys.used_swap(),
            uptime: System::uptime(),
            load_average: System::load_average().into(),
            processes: sys.processes().len(),
        }
    }

    pub fn get_cpu_history(&self) -> Vec<f32> {
        self.cpu_history.lock().clone()
    }

    pub fn get_memory_history(&self) -> Vec<(u64, u64)> {
        self.memory_history.lock().clone()
    }

    pub fn get_process_list(&self, limit: usize) -> Vec<SysProcessInfo> {
        let sys = self.sys.lock();
        let mut processes: Vec<_> = sys.processes().values().collect();
        processes.sort_by(|a, b| b.cpu_usage().partial_cmp(&a.cpu_usage()).unwrap());

        processes.into_iter().take(limit).map(|p| SysProcessInfo {
            pid: p.pid().as_u32(),
            name: p.name().to_string_lossy().to_string(),
            cpu_usage: p.cpu_usage(),
            memory: p.memory(),
            virtual_memory: p.virtual_memory(),
            parent_pid: p.parent().map(|p| p.as_u32()),
            start_time: p.start_time(),
            run_time: p.run_time(),
            status: format!("{:?}", p.status()),
            cmd: p.cmd().iter().map(|s| s.to_string_lossy().to_string()).collect::<Vec<_>>().join(" "),
            cwd: p.cwd().map(|p| p.to_string_lossy().to_string()),
            root: p.root().map(|p| p.to_string_lossy().to_string()),
            environ: p.environ().iter().map(|s| s.to_string_lossy().to_string()).collect(),
            exe: p.exe().map(|p| p.to_string_lossy().to_string()),
        }).collect()
    }
}

pub struct GpuMonitor {
    gpus: Arc<Mutex<Vec<SysGpuDevice>>>,
    last_update: Mutex<SystemTime>,
}

impl GpuMonitor {
    pub fn new() -> Self {
        let gpus = Self::detect_gpus();
        Self {
            gpus: Arc::new(Mutex::new(gpus)),
            last_update: Mutex::new(SystemTime::now()),
        }
    }

    fn detect_gpus() -> Vec<SysGpuDevice> {
        let mut gpus = Vec::new();

        #[cfg(target_os = "windows")]
        {
            if let Ok(nvidia) = Self::detect_nvidia_windows() {
                gpus.extend(nvidia);
            }
            if let Ok(amd) = Self::detect_amd_windows() {
                gpus.extend(amd);
            }
            if let Ok(intel) = Self::detect_intel_windows() {
                gpus.extend(intel);
            }
        }

        #[cfg(target_os = "linux")]
        {
            if let Ok(nvidia) = Self::detect_nvidia_linux() {
                gpus.extend(nvidia);
            }
            if let Ok(amd) = Self::detect_amd_linux() {
                gpus.extend(amd);
            }
        }

        #[cfg(target_os = "macos")]
        {
            if let Ok(apple) = Self::detect_apple_gpu() {
                gpus.extend(apple);
            }
        }

        gpus
    }

    #[cfg(target_os = "windows")]
    fn detect_nvidia_windows() -> Result<Vec<SysGpuDevice>> {
        use std::process::Command;

        let output = Command::new("nvidia-smi")
            .args(["--query-gpu=index,name,memory.total,memory.used,utilization.gpu,temperature.gpu,power.draw", "--format=csv,noheader,nounits"])
            .output()?;

        let mut gpus = Vec::new();
        for line in String::from_utf8_lossy(&output.stdout).lines() {
            let parts: Vec<&str> = line.split(", ").collect();
            if parts.len() >= 7 {
                gpus.push(SysGpuDevice {
                    index: parts[0].parse().unwrap_or(0),
                    name: parts[1].to_string(),
                    vendor: GpuVendor::Nvidia,
                    memory_total: parts[2].parse::<u64>().unwrap_or(0) * 1024 * 1024,
                    memory_used: parts[3].parse::<u64>().unwrap_or(0) * 1024 * 1024,
                    utilization: parts[4].parse::<f32>().unwrap_or(0.0),
                    temperature: parts[5].parse::<i32>().ok(),
                    power_draw: parts[6].parse::<f32>().ok(),
                    compute_capability: None,
                    driver_version: None,
                });
            }
        }
        Ok(gpus)
    }

    #[cfg(target_os = "windows")]
    fn detect_amd_windows() -> Result<Vec<SysGpuDevice>> {
        Ok(Vec::new())
    }

    #[cfg(target_os = "windows")]
    fn detect_intel_windows() -> Result<Vec<SysGpuDevice>> {
        Ok(Vec::new())
    }

    #[cfg(target_os = "linux")]
    fn detect_nvidia_linux() -> Result<Vec<SysGpuDevice>> {
        use std::process::Command;

        let output = Command::new("nvidia-smi")
            .args(["--query-gpu=index,name,memory.total,memory.used,utilization.gpu,temperature.gpu,power.draw", "--format=csv,noheader,nounits"])
            .output()?;

        let mut gpus = Vec::new();
        for line in String::from_utf8_lossy(&output.stdout).lines() {
            let parts: Vec<&str> = line.split(", ").collect();
            if parts.len() >= 7 {
                gpus.push(SysGpuDevice {
                    index: parts[0].parse().unwrap_or(0),
                    name: parts[1].to_string(),
                    vendor: GpuVendor::Nvidia,
                    memory_total: parts[2].parse::<u64>().unwrap_or(0) * 1024 * 1024,
                    memory_used: parts[3].parse::<u64>().unwrap_or(0) * 1024 * 1024,
                    utilization: parts[4].parse::<f32>().unwrap_or(0.0),
                    temperature: parts[5].parse::<i32>().ok(),
                    power_draw: parts[6].parse::<f32>().ok(),
                    compute_capability: None,
                    driver_version: None,
                });
            }
        }
        Ok(gpus)
    }

    #[cfg(target_os = "linux")]
    fn detect_amd_linux() -> Result<Vec<SysGpuDevice>> {
        Ok(Vec::new())
    }

    #[cfg(target_os = "macos")]
    fn detect_apple_gpu() -> Result<Vec<SysGpuDevice>> {
        Ok(Vec::new())
    }

    pub fn get_gpus(&self) -> Vec<SysGpuDevice> {
        self.gpus.lock().clone()
    }

    pub async fn update(&self) {
        let gpus = Self::detect_gpus();
        *self.gpus.lock() = gpus;
        *self.last_update.lock() = SystemTime::now();
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SysGpuDevice {
    pub index: usize,
    pub name: String,
    pub vendor: GpuVendor,
    pub memory_total: u64,
    pub memory_used: u64,
    pub utilization: f32,
    pub temperature: Option<i32>,
    pub power_draw: Option<f32>,
    pub compute_capability: Option<String>,
    pub driver_version: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CpuCoreInfo {
    pub name: String,
    pub usage: f32,
    pub frequency: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SysProcessInfo {
    pub pid: u32,
    pub name: String,
    pub cpu_usage: f32,
    pub memory: u64,
    pub virtual_memory: u64,
    pub parent_pid: Option<u32>,
    pub start_time: u64,
    pub run_time: u64,
    pub status: String,
    pub cmd: String,
    pub cwd: Option<String>,
    pub root: Option<String>,
    pub environ: Vec<String>,
    pub exe: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemSnapshot {
    pub cpu_percent: f32,
    pub cpu_cores: Vec<CpuCoreInfo>,
    pub memory_total: u64,
    pub memory_used: u64,
    pub memory_available: u64,
    pub swap_total: u64,
    pub swap_used: u64,
    pub uptime: u64,
    pub load_average: LoadAverage,
    pub processes: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoadAverage {
    pub one: f64,
    pub five: f64,
    pub fifteen: f64,
}

impl From<sysinfo::LoadAvg> for LoadAverage {
    fn from(l: sysinfo::LoadAvg) -> Self {
        Self {
            one: l.one,
            five: l.five,
            fifteen: l.fifteen,
        }
    }
}

pub struct HardwareDetector;

impl HardwareDetector {
    pub fn detect() -> SysHardwareInfo {
        let mut sys = System::new_all();
        sys.refresh_all();

        let cpu_info = Self::detect_cpu(&sys);
        let memory = Self::detect_memory(&sys);
        let gpus = GpuMonitor::new().get_gpus();
        let os = Self::detect_os();
        let llama_cpp_flags = Self::recommended_flags(&cpu_info, &gpus);

        SysHardwareInfo {
            cpu: cpu_info,
            memory,
            gpus,
            os,
            llama_cpp_flags,
        }
    }

    fn detect_cpu(sys: &System) -> SysCpuInfo {
        SysCpuInfo {
            cores: sys.cpus().len(),
            physical_cores: num_cpus::get(),
            frequency: sys.cpus().first().map(|c| c.frequency()).unwrap_or(0),
            vendor: Self::get_cpu_vendor(),
            brand: sys.cpus().first().map(|c| c.name().to_string()).unwrap_or_default(),
            cache_l1: None,
            cache_l2: None,
            cache_l3: None,
        }
    }

    fn detect_memory(sys: &System) -> SysMemoryInfo {
        SysMemoryInfo {
            total: sys.total_memory(),
            available: sys.available_memory(),
            swap_total: sys.total_swap(),
            swap_used: sys.used_swap(),
        }
    }

    fn detect_os() -> SysOsInfo {
        SysOsInfo {
            name: std::env::consts::OS.to_string(),
            version: Self::get_os_version(),
            arch: std::env::consts::ARCH.to_string(),
        }
    }

    fn get_cpu_vendor() -> String {
        match std::env::consts::ARCH {
            "x86_64" | "x86" => {
                // Could use raw_cpuid crate for detailed detection
                std::env::consts::ARCH.to_string()
            }
            _ => std::env::consts::ARCH.to_string(),
        }
    }

    fn get_os_version() -> String {
        #[cfg(target_os = "windows")]
        {
            use std::process::Command;
            if let Ok(output) = Command::new("cmd").args(["/C", "ver"]).output() {
                return String::from_utf8_lossy(&output.stdout).trim().to_string();
            }
        }
        #[cfg(target_os = "linux")]
        {
            std::fs::read_to_string("/etc/os-release")
                .ok()
                .and_then(|s| s.lines().find(|l| l.starts_with("VERSION=")))
                .map(|l| l.trim_start_matches("VERSION=").trim_matches('"').to_string())
                .unwrap_or_default()
        }
        #[cfg(target_os = "macos")]
        {
            use std::process::Command;
            if let Ok(output) = Command::new("sw_vers").arg("-productVersion").output() {
                return String::from_utf8_lossy(&output.stdout).trim().to_string();
            }
        }
        String::new()
    }

    fn recommended_flags(cpu: &SysCpuInfo, gpus: &[SysGpuDevice]) -> LlamaCppFlags {
        let mut flags = LlamaCppFlags::default();

        if cpu.vendor.contains("GenuineIntel") || cpu.vendor.contains("AuthenticAMD") {
            flags.avx = true;
            flags.avx2 = true;
            flags.fma = true;
        }

        let has_nvidia = gpus.iter().any(|g| g.vendor == GpuVendor::Nvidia);
        let has_amd = gpus.iter().any(|g| g.vendor == GpuVendor::Amd);
        let has_apple = gpus.iter().any(|g| g.vendor == GpuVendor::Apple);

        if has_nvidia {
            flags.cuda = true;
        }
        if has_amd {
            flags.rocm = true;
        }
        if has_apple {
            flags.metal = true;
        }

        flags.vulkan = Self::has_vulkan();

        flags
    }

    fn has_vulkan() -> bool {
        std::env::var("VK_ICD_FILENAMES").is_ok()
            || std::path::Path::new("/usr/share/vulkan/icd.d").exists()
            || std::path::Path::new("C:\\Windows\\System32\\vulkan-1.dll").exists()
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SysHardwareInfo {
    pub cpu: SysCpuInfo,
    pub memory: SysMemoryInfo,
    pub gpus: Vec<SysGpuDevice>,
    pub os: SysOsInfo,
    pub llama_cpp_flags: LlamaCppFlags,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct SysCpuInfo {
    pub cores: usize,
    pub physical_cores: usize,
    pub frequency: u64,
    pub vendor: String,
    pub brand: String,
    pub cache_l1: Option<u64>,
    pub cache_l2: Option<u64>,
    pub cache_l3: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SysMemoryInfo {
    pub total: u64,
    pub available: u64,
    pub swap_total: u64,
    pub swap_used: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SysOsInfo {
    pub name: String,
    pub version: String,
    pub arch: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct LlamaCppFlags {
    pub avx: bool,
    pub avx2: bool,
    pub avx512: bool,
    pub amx: bool,
    pub fma: bool,
    pub neon: bool,
    pub sve: bool,
    pub cuda: bool,
    pub rocm: bool,
    pub metal: bool,
    pub vulkan: bool,
    pub opencl: bool,
    pub mpi: bool,
    pub blas: bool,
    pub blas_vendor: Option<String>,
}
