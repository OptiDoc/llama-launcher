pub async fn detect_nvidia_gpu() -> (String, f64, bool) {
    let output = tokio::process::Command::new("nvidia-smi")
        .args(["--query-gpu=name,memory.total,compute_cap,driver_version", "--format=csv,noheader,nounits"])
        .output()
        .await;

    match output {
        Ok(out) if out.status.success() => {
            let stdout = String::from_utf8_lossy(&out.stdout);
            let first_line = stdout.lines().next().unwrap_or("");
            let parts: Vec<&str> = first_line.split(',').map(|s| s.trim()).collect();
            if parts.len() >= 2 {
                let name = parts[0].to_string();
                let vram_mb: f64 = parts[1].parse().unwrap_or(0.0);
                return (name, vram_mb / 1024.0, true);
            }
            crate::log_debug!("nvidia-smi returned unexpected output format", "releases");
        }
        Ok(out) => {
            crate::log_debug!(&format!("nvidia-smi exited with status: {}", out.status), "releases");
        }
        Err(e) => {
            crate::log_debug!(&format!("nvidia-smi not available: {}", e), "releases");
        }
    }

    (String::new(), 0.0, false)
}

pub async fn detect_amd_gpu() -> (String, f64, bool) {
    match tokio::process::Command::new("rocm-smi")
        .args(["--showproductname", "--showmeminfo", "vram", "--csv"])
        .output()
        .await
    {
        Ok(out) if out.status.success() => {
            let stdout = String::from_utf8_lossy(&out.stdout);
            let lines: Vec<&str> = stdout.lines().collect();
            if lines.len() > 1 {
                let name = lines[1].split(',').next().unwrap_or("AMD GPU").trim().to_string();
                for line in &lines[1..] {
                    let parts: Vec<&str> = line.split(',').map(|s| s.trim()).collect();
                    for p in &parts {
                        if let Ok(mb) = p.parse::<f64>() {
                            if mb > 100.0 {
                                return (name, mb / 1024.0, true);
                            }
                        }
                    }
                }
                return (name, 0.0, true);
            }
        }
        Ok(out) => {
            crate::log_debug!(&format!("rocm-smi exited with status: {}", out.status), "releases");
        }
        Err(e) => {
            crate::log_debug!(&format!("rocm-smi not available: {}", e), "releases");
        }
    }

    #[cfg(target_os = "windows")]
    {
        match tokio::process::Command::new("wmic")
            .args(["path", "win32_videocontroller", "get", "name,AdapterRAM", "/format:csv"])
            .output()
            .await
        {
            Ok(out) if out.status.success() => {
                let stdout = String::from_utf8_lossy(&out.stdout);
                for line in stdout.lines().skip(1) {
                    let lower = line.to_lowercase();
                    if lower.contains("amd") || lower.contains("radeon") {
                        let parts: Vec<&str> = line.split(',').collect();
                        if let Some(ram_str) = parts.get(1) {
                            if let Ok(ram_bytes) = ram_str.trim().parse::<u64>() {
                                return (parts.get(2).unwrap_or(&"AMD GPU").trim().to_string(), ram_bytes as f64 / (1024.0 * 1024.0 * 1024.0), true);
                            }
                        }
                    }
                }
            }
            Ok(out) => {
                crate::log_debug!(&format!("wmic (AMD) exited with status: {}", out.status), "releases");
            }
            Err(e) => {
                crate::log_debug!(&format!("wmic (AMD) not available: {}", e), "releases");
            }
        }
    }

    (String::new(), 0.0, false)
}

pub fn detect_intel_gpu() -> (String, f64) {
    #[cfg(target_os = "windows")]
    {
        match std::process::Command::new("wmic")
            .args(["path", "win32_videocontroller", "get", "name,AdapterRAM", "/format:csv"])
            .output()
        {
            Ok(out) if out.status.success() => {
                let stdout = String::from_utf8_lossy(&out.stdout);
                for line in stdout.lines().skip(1) {
                    let lower = line.to_lowercase();
                    if lower.contains("intel") {
                        let parts: Vec<&str> = line.split(',').collect();
                        if let Some(ram_str) = parts.get(1) {
                            if let Ok(ram_bytes) = ram_str.trim().parse::<u64>() {
                                return (parts.get(2).unwrap_or(&"Intel GPU").trim().to_string(), ram_bytes as f64 / (1024.0 * 1024.0 * 1024.0));
                            }
                        }
                    }
                }
            }
            Ok(out) => {
                crate::log_debug!(&format!("wmic (Intel) exited with status: {}", out.status), "releases");
            }
            Err(e) => {
                crate::log_debug!(&format!("wmic (Intel) not available: {}", e), "releases");
            }
        }
    }

    (String::new(), 0.0)
}

pub fn detect_vulkan() -> bool {
    #[cfg(target_os = "windows")]
    {
        return std::path::Path::new("C:\\Windows\\System32\\vulkan-1.dll").exists();
    }
    #[cfg(target_os = "macos")]
    {
        return false;
    }
    #[cfg(target_os = "linux")]
    {
        let paths = [
            "/usr/lib/x86_64-linux-gnu/libvulkan.so",
            "/usr/lib64/libvulkan.so",
            "/usr/local/lib/libvulkan.so",
            "/usr/lib/libvulkan.so",
        ];
        return paths.iter().any(|p| std::path::Path::new(p).exists());
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    {
        return false;
    }
}
