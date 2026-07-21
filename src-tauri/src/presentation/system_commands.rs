use std::path::Path;

use crate::application::AppState;
use crate::{GpuInfo, GpuVendor, SystemSnapshot};

#[tauri::command]
pub async fn get_system_info(state: tauri::State<'_, AppState>) -> Result<SystemSnapshot, String> {
    let mut monitor = state.system_monitor.lock().unwrap();
    monitor.update();
    let stats = monitor.get_stats();
    Ok(SystemSnapshot {
        cpu_percent: stats.cpu_percent,
        cpu_name: stats.cpu_name,
        cpu_cores_physical: stats.cpu_cores_physical,
        cpu_cores_logical: stats.cpu_cores_logical,
        memory_total_mb: stats.memory_total_mb,
        memory_used_mb: stats.memory_used_mb,
        memory_available_mb: stats.memory_available_mb,
        disk_total_gb: stats.disk_total_gb,
        disk_used_gb: stats.disk_used_gb,
        disk_free_gb: stats.disk_free_gb,
        os_name: stats.os_name,
        os_version: stats.os_version,
    })
}

#[tauri::command]
pub async fn get_gpu_info() -> Result<Vec<GpuInfo>, String> {
    let mut gpus = Vec::new();

    if let Ok(out) = tokio::process::Command::new("nvidia-smi")
        .args([
            "--query-gpu=index,name,memory.total,memory.used,memory.free,utilization.gpu,temperature.gpu,compute_cap,driver_version",
            "--format=csv,noheader,nounits",
        ])
        .output()
        .await
    {
        if out.status.success() {
            let stdout = String::from_utf8_lossy(&out.stdout);
            for line in stdout.lines() {
                let parts: Vec<&str> = line.split(',').map(|s| s.trim()).collect();
                if parts.len() >= 6 {
                    gpus.push(GpuInfo {
                        index: parts[0].parse().unwrap_or(0),
                        name: parts[1].to_string(),
                        vendor: GpuVendor::Nvidia,
                        memory_total_mb: parts[2].parse().unwrap_or(0),
                        memory_used_mb: parts[3].parse().unwrap_or(0),
                        memory_free_mb: parts.get(4).and_then(|s| s.parse().ok()).unwrap_or(0),
                        utilization_percent: parts.get(5).and_then(|s| s.parse().ok()),
                        temperature_c: parts.get(6).and_then(|s| s.parse().ok()),
                        compute_capability: parts.get(7).filter(|s| !s.is_empty()).map(|s| s.to_string()),
                        driver_version: parts.get(8).filter(|s| !s.is_empty()).map(|s| s.to_string()),
                    });
                }
            }
        }
    }

    if gpus.is_empty() {
        #[cfg(target_os = "linux")]
        {
            if let Ok(out) = tokio::process::Command::new("rocm-smi")
                .args(["--showproductname", "--showmeminfo", "vram", "--showuse", "--showtemp", "--csv"])
                .output()
                .await
            {
                if out.status.success() {
                    let stdout = String::from_utf8_lossy(&out.stdout);
                    let lines: Vec<&str> = stdout.lines().collect();
                    for (i, line) in lines.iter().enumerate().skip(1) {
                        let parts: Vec<&str> = line.split(',').map(|s| s.trim()).collect();
                        if !parts.is_empty() {
                            let name = parts[0].to_string();
                            let mut vram_total = 0u64;
                            let mut vram_used = 0u64;
                            let mut temp = None;
                            let mut util = None;
                            for p in &parts[1..] {
                                if let Ok(v) = p.parse::<u64>() {
                                    if v > 1_000_000 { vram_total = v / (1024 * 1024); }
                                    else if v > 100 && vram_total == 0 { vram_total = v; }
                                    else if v > 100 && vram_total > 0 && vram_used == 0 { vram_used = v; }
                                }
                                if let Ok(v) = p.parse::<f32>() {
                                    if v > 0.0 && v <= 100.0 && util.is_none() { util = Some(v as u32); }
                                    else if v > 0.0 && v < 200.0 && temp.is_none() { temp = Some(v as u32); }
                                }
                            }
                            gpus.push(GpuInfo {
                                index: i - 1,
                                name,
                                vendor: GpuVendor::Amd,
                                memory_total_mb: vram_total,
                                memory_used_mb: vram_used,
                                memory_free_mb: vram_total.saturating_sub(vram_used),
                                utilization_percent: util,
                                temperature_c: temp,
                                compute_capability: None,
                                driver_version: None,
                            });
                        }
                    }
                }
            }
        }

        #[cfg(target_os = "windows")]
        {
            if let Ok(out) = tokio::process::Command::new("wmic")
                .args(["path", "win32_videocontroller", "get", "name,AdapterRAM,DriverVersion", "/format:csv"])
                .output()
                .await
            {
                if out.status.success() {
                    let stdout = String::from_utf8_lossy(&out.stdout);
                    for (i, line) in stdout.lines().enumerate().skip(1) {
                        let parts: Vec<&str> = line.split(',').collect();
                        if parts.len() >= 3 {
                            let name = parts.get(2).unwrap_or(&"GPU").trim().to_string();
                            let ram_bytes: u64 = parts.get(1).unwrap_or(&"0").trim().parse().unwrap_or(0);
                            let driver = parts.get(3).filter(|s| !s.trim().is_empty()).map(|s| s.trim().to_string());
                            let vendor = if name.to_lowercase().contains("nvidia") { GpuVendor::Nvidia }
                                else if name.to_lowercase().contains("amd") || name.to_lowercase().contains("radeon") { GpuVendor::Amd }
                                else if name.to_lowercase().contains("intel") { GpuVendor::Intel }
                                else { GpuVendor::Other };
                            gpus.push(GpuInfo {
                                index: i,
                                name,
                                vendor,
                                memory_total_mb: ram_bytes / (1024 * 1024),
                                memory_used_mb: 0,
                                memory_free_mb: ram_bytes / (1024 * 1024),
                                utilization_percent: None,
                                temperature_c: None,
                                compute_capability: None,
                                driver_version: driver,
                            });
                        }
                    }
                }
            }
        }
    }

    Ok(gpus)
}

#[tauri::command]
pub async fn detect_llama_binary() -> Result<Option<String>, String> {
    let binary_name = if cfg!(target_os = "windows") {
        "llama-server.exe"
    } else {
        "llama-server"
    };

    if let Ok(output) = tokio::process::Command::new("which")
        .arg(binary_name)
        .output()
        .await
    {
        let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if !path.is_empty() {
            return Ok(Some(path));
        }
    }

    let common_paths = vec![
        "./llama-server",
        "./llama.cpp/llama-server",
        "../llama.cpp/llama-server",
    ];

    for path in common_paths {
        let expanded = shellexpand::tilde(path).to_string();
        if Path::new(&expanded).exists() {
            return Ok(Some(expanded));
        }
    }

    Ok(None)
}
