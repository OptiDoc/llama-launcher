use std::path::{PathBuf};
use std::sync::Arc;

use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::{Child, Command};
use tokio::sync::Mutex;
use tracing::{error, info};

use crate::core::*;

pub struct LlamaServer {
    process: Arc<Mutex<Option<Child>>>,
    config: ServerConfig,
    #[allow(dead_code)]
    port: u16,
    model_path: PathBuf,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerConfig {
    pub model: String,
    pub host: String,
    pub port: u16,
    pub context_size: usize,
    pub gpu_layers: i32,
    pub threads: usize,
    pub batch_size: usize,
    pub ubatch_size: usize,
    pub flash_attn: bool,
    pub no_mmap: bool,
    pub no_mlock: bool,
    pub numa: bool,
    pub embedding: bool,
    pub reranking: bool,
    pub additional_args: Vec<String>,
}

impl Default for ServerConfig {
    fn default() -> Self {
        let config = GLOBAL_STATE.config.read();
        Self {
            model: String::new(),
            host: "127.0.0.1".to_string(),
            port: 8080,
            context_size: config.default_context_size,
            gpu_layers: config.default_gpu_layers,
            threads: config.default_threads,
            batch_size: config.default_batch_size,
            ubatch_size: config.default_batch_size,
            flash_attn: config.flash_attn,
            no_mmap: config.no_mmap,
            no_mlock: config.no_mlock,
            numa: config.numa,
            embedding: false,
            reranking: false,
            additional_args: Vec::new(),
        }
    }
}

impl LlamaServer {
    pub fn new(model_path: PathBuf, port: u16, config: ServerConfig) -> Self {
        Self {
            process: Arc::new(Mutex::new(None)),
            config,
            port,
            model_path,
        }
    }

    pub async fn start(&self) -> Result<u32> {
        let llama_binary = self.find_binary()?;

        let mut args = vec![
            "-m".to_string(),
            self.model_path.to_string_lossy().to_string(),
            "--host".to_string(),
            self.config.host.clone(),
            "--port".to_string(),
            self.config.port.to_string(),
            "--ctx-size".to_string(),
            self.config.context_size.to_string(),
            "--n-gpu-layers".to_string(),
            self.config.gpu_layers.to_string(),
            "--threads".to_string(),
            self.config.threads.to_string(),
            "--batch-size".to_string(),
            self.config.batch_size.to_string(),
            "--ubatch-size".to_string(),
            self.config.ubatch_size.to_string(),
        ];

        if self.config.flash_attn {
            args.push("--flash-attn".to_string());
        }
        if self.config.no_mmap {
            args.push("--no-mmap".to_string());
        }
        if self.config.no_mlock {
            args.push("--no-mlock".to_string());
        }
        if self.config.numa {
            args.push("--numa".to_string());
        }
        if self.config.embedding {
            args.push("--embedding".to_string());
        }
        if self.config.reranking {
            args.push("--reranking".to_string());
        }

        args.extend(self.config.additional_args.clone());

        let mut child = Command::new(&llama_binary)
            .args(&args)
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped())
            .stdin(std::process::Stdio::null())
            .spawn()
            .context("Failed to spawn llama-server")?;

        let pid = child.id().unwrap_or(0);

        if let Some(stderr) = child.stderr.take() {
            let reader = BufReader::new(stderr);
            let mut lines = reader.lines();

            tokio::spawn(async move {
                while let Ok(Some(line)) = lines.next_line().await {
                    if line.contains("HTTP server listening")
                        || line.contains("server is ready")
                        || line.contains("listening on")
                    {
                        info!("llama-server ready on port");
                        break;
                    }
                    if line.contains("error") || line.contains("Error") {
                        error!("llama-server error: {}", line);
                    }
                }
            });
        }

        Ok(pid)
    }

    pub async fn stop(&self) -> Result<()> {
        let mut process_guard = self.process.lock().await;
        if let Some(child) = process_guard.as_mut() {
            child.kill().await?;
        }
        *process_guard = None;
        Ok(())
    }

    pub async fn is_running(&self) -> bool {
        let mut process_guard = self.process.lock().await;
        if let Some(child) = process_guard.as_mut() {
            child.try_wait().unwrap_or(None).is_none()
        } else {
            false
        }
    }

    fn find_binary(&self) -> Result<PathBuf> {
        let config = GLOBAL_STATE.config.read();

        if let Some(ref path) = config.llama_binary_path {
            let p = PathBuf::from(path);
            if p.exists() {
                return Ok(p);
            }
        }

        let binary_name = if cfg!(target_os = "windows") {
            "llama-server.exe"
        } else {
            "llama-server"
        };

        if let Ok(output) = std::process::Command::new("which").arg(binary_name).output() {
            let path = PathBuf::from(String::from_utf8_lossy(&output.stdout).trim().to_string());
            if path.exists() {
                return Ok(path);
            }
        }

        let common_paths = vec![
            PathBuf::from(binary_name),
            PathBuf::from("./llama.cpp").join(binary_name),
            PathBuf::from("../llama.cpp").join(binary_name),
        ];

        for path in common_paths {
            if path.exists() {
                return Ok(path);
            }
        }

        Err(anyhow::anyhow!(
            "llama-server binary not found. Please build llama.cpp or set path in settings."
        ))
    }
}

pub mod quantization {
    use std::path::Path;
    use serde::{Deserialize, Serialize};

    #[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
    pub enum QuantizationType {
        Q2K,
        Q3K,
        Q3KM,
        Q4K,
        Q4KM,
        Q5K,
        Q5KM,
        Q6K,
        Q8K,
        IQ1,
        IQ2,
        IQ3,
        IQ4,
        F16,
        F32,
        Unknown,
    }

    impl QuantizationType {
        pub fn from_filename(path: &Path) -> Self {
            let name = path
                .file_name()
                .and_then(|s| s.to_str())
                .unwrap_or("")
                .to_lowercase();

            if name.contains("q2_k") {
                Self::Q2K
            } else if name.contains("q3_k_m") {
                Self::Q3KM
            } else if name.contains("q3_k") {
                Self::Q3K
            } else if name.contains("q4_k_m") {
                Self::Q4KM
            } else if name.contains("q4_k") {
                Self::Q4K
            } else if name.contains("q5_k_m") {
                Self::Q5KM
            } else if name.contains("q5_k") {
                Self::Q5K
            } else if name.contains("q6_k") {
                Self::Q6K
            } else if name.contains("q8_k") {
                Self::Q8K
            } else if name.contains("iq1") {
                Self::IQ1
            } else if name.contains("iq2") {
                Self::IQ2
            } else if name.contains("iq3") {
                Self::IQ3
            } else if name.contains("iq4") {
                Self::IQ4
            } else if name.contains("f16") {
                Self::F16
            } else if name.contains("f32") {
                Self::F32
            } else {
                Self::Unknown
            }
        }

        pub fn bits_per_weight(&self) -> f32 {
            match self {
                Self::Q2K => 2.0,
                Self::Q3K | Self::Q3KM => 3.0,
                Self::Q4K | Self::Q4KM => 4.0,
                Self::Q5K | Self::Q5KM => 5.0,
                Self::Q6K => 6.0,
                Self::Q8K => 8.0,
                Self::IQ1 => 1.0,
                Self::IQ2 => 2.0,
                Self::IQ3 => 3.0,
                Self::IQ4 => 4.0,
                Self::F16 => 16.0,
                Self::F32 => 32.0,
                Self::Unknown => 4.0,
            }
        }

        pub fn estimated_vram_per_billion(&self) -> f32 {
            self.bits_per_weight() / 8.0 * 1e9 / 1024.0 / 1024.0 / 1024.0 * 1.2
        }
    }

    pub fn estimate_model_vram(
        quantization: QuantizationType,
        parameter_count: u64,
        context_size: usize,
    ) -> u64 {
        let bpw = quantization.bits_per_weight() as f64;
        let weights_mb =
            (parameter_count as f64 * bpw / 8.0 / 1024.0 / 1024.0) as u64;
        let kv_cache_mb = (context_size as f64 * 2.0 * 4.0 / 1024.0 / 1024.0) as u64;
        let overhead_mb = (weights_mb as f64 * 0.2) as u64;
        weights_mb + kv_cache_mb + overhead_mb
    }
}

pub mod validation {
    use std::io::Read;
    use std::path::Path;
    use anyhow::Result;
    use serde::{Deserialize, Serialize};

    pub fn validate_gguf(path: &Path) -> Result<ModelValidation> {
        let file = std::fs::File::open(path)?;
        let mut reader = std::io::BufReader::new(file);

        let mut magic = [0u8; 4];
        reader.read_exact(&mut magic)?;
        if &magic != b"GGUF" {
            return Err(anyhow::anyhow!("Not a valid GGUF file"));
        }

        let mut version = [0u8; 4];
        reader.read_exact(&mut version)?;
        let _version = u32::from_le_bytes(version);

        let mut tensor_count = [0u8; 8];
        reader.read_exact(&mut tensor_count)?;
        let _tensor_count = u64::from_le_bytes(tensor_count);

        Ok(ModelValidation {
            is_valid: true,
            format: "GGUF".to_string(),
            errors: Vec::new(),
            warnings: Vec::new(),
        })
    }

    #[derive(Debug, Serialize, Deserialize)]
    pub struct ModelValidation {
        pub is_valid: bool,
        pub format: String,
        pub errors: Vec<String>,
        pub warnings: Vec<String>,
    }
}

pub mod hardware {
    use serde::{Deserialize, Serialize};
    use sysinfo::System;

    use crate::GpuVendor;

    #[derive(Debug, Clone, Serialize, Deserialize)]
    pub struct HardwareInfo {
        pub cpu: CpuInfo,
        pub memory: MemoryInfo,
        pub gpus: Vec<GpuDevice>,
        pub os: OsInfo,
    }

    #[derive(Debug, Clone, Serialize, Deserialize)]
    pub struct CpuInfo {
        pub name: String,
        pub vendor: String,
        pub cores: usize,
        pub threads: usize,
        pub frequency_mhz: u64,
    }

    #[derive(Debug, Clone, Serialize, Deserialize)]
    pub struct MemoryInfo {
        pub total_mb: u64,
        pub available_mb: u64,
    }

    #[derive(Debug, Clone, Serialize, Deserialize)]
    pub struct GpuDevice {
        pub index: usize,
        pub name: String,
        pub vendor: GpuVendor,
        pub vram_mb: u64,
        pub compute_capability: Option<String>,
        pub driver_version: Option<String>,
        pub supports_cuda: bool,
        pub supports_rocm: bool,
        pub supports_metal: bool,
        pub supports_vulkan: bool,
        pub supports_opencl: bool,
    }

    #[derive(Debug, Clone, Serialize, Deserialize)]
    pub struct OsInfo {
        pub name: String,
        pub version: String,
        pub arch: String,
    }

    pub fn detect_hardware() -> HardwareInfo {
        let mut sys = System::new_all();
        sys.refresh_all();

        let cpu_info = if let Some(cpu) = sys.cpus().first() {
            CpuInfo {
                name: cpu.name().to_string(),
                vendor: cpu.vendor_id().to_string(),
                cores: sys.physical_core_count().unwrap_or(1),
                threads: sys.cpus().len(),
                frequency_mhz: cpu.frequency(),
            }
        } else {
            CpuInfo {
                name: "Unknown".to_string(),
                vendor: "Unknown".to_string(),
                cores: 1,
                threads: 1,
                frequency_mhz: 0,
            }
        };

        let gpus = detect_gpus();

        HardwareInfo {
            cpu: cpu_info,
            memory: MemoryInfo {
                total_mb: sys.total_memory() / 1024 / 1024,
                available_mb: sys.available_memory() / 1024 / 1024,
            },
            gpus,
            os: OsInfo {
                name: System::name().unwrap_or_default(),
                version: System::os_version().unwrap_or_default(),
                arch: std::env::consts::ARCH.to_string(),
            },
        }
    }

    fn detect_gpus() -> Vec<GpuDevice> {
        let mut gpus = Vec::new();

        #[cfg(target_os = "windows")]
        {
            if let Ok(output) = std::process::Command::new("wmic")
                .args([
                    "path",
                    "win32_VideoController",
                    "get",
                    "Name,AdapterRAM,DriverVersion",
                ])
                .output()
            {
                let output = String::from_utf8_lossy(&output.stdout);
                for line in output.lines().skip(1) {
                    let line = line.trim();
                    if line.is_empty() {
                        continue;
                    }
                    let parts: Vec<&str> = line.split_whitespace().collect();
                    if parts.len() >= 2 {
                        let name = parts[..parts.len() - 2].join(" ");
                        let vram = parts[parts.len() - 2].parse::<u64>().unwrap_or(0) / 1024 / 1024;
                        let driver = parts.last().unwrap_or(&"").to_string();

                        let vendor = if name.to_lowercase().contains("nvidia") {
                            GpuVendor::Nvidia
                        } else if name.to_lowercase().contains("amd")
                            || name.to_lowercase().contains("radeon")
                        {
                            GpuVendor::Amd
                        } else if name.to_lowercase().contains("intel") {
                            GpuVendor::Intel
                        } else {
                            GpuVendor::Other
                        };

                        gpus.push(GpuDevice {
                            index: gpus.len(),
                            name,
                            vendor,
                            vram_mb: vram,
                            compute_capability: None,
                            driver_version: Some(driver),
                            supports_cuda: vendor == GpuVendor::Nvidia,
                            supports_rocm: vendor == GpuVendor::Amd,
                            supports_metal: false,
                            supports_vulkan: true,
                            supports_opencl: true,
                        });
                    }
                }
            }
        }

        gpus
    }
}
