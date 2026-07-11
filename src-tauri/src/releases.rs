use serde::{Deserialize, Serialize};
use tracing::{info, warn};

/// A llama.cpp release variant (build backend).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReleaseVariant {
    pub id: String,
    pub label: String,
    pub priority: bool,
    pub note: String,
}

/// A llama.cpp release from GitHub.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitHubRelease {
    pub id: String,
    pub tag: String,
    pub published_at: String,
    pub commit: String,
    pub notes: String,
    pub installed: bool,
    pub variant: String,
    pub priority: bool,
    pub download_url: String,
    pub size_mb: u64,
}

/// Detected system capabilities — used to warn when a model is too large.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemCapabilities {
    pub gpu_name: String,
    pub gpu_vram_gb: f64,
    pub ram_gb: f64,
    pub cpu_cores: usize,
    pub has_cuda: bool,
    pub has_vulkan: bool,
    pub has_metal: bool,
}

const KNOWN_VARIANTS: &[(&str, &str, bool, &str)] = &[
    ("cuda12", "CUDA 12.x", true, "NVIDIA GPU (cuBLAS, recommended)"),
    ("cuda13", "CUDA 13.x", true, "NVIDIA GPU (newest CUDA toolkit)"),
    ("vulkan", "Vulkan", true, "Cross-vendor GPU (AMD/Intel/NVIDIA)"),
    ("cpu", "CPU", false, "No GPU acceleration"),
    ("hip", "HIP / ROCm", false, "AMD GPU (Linux)"),
    ("opencl", "OpenCL", false, "OpenCL GPU backend"),
    ("metal", "Metal", false, "Apple Silicon (macOS)"),
];

#[tauri::command]
pub async fn list_release_variants() -> Result<Vec<ReleaseVariant>, String> {
    Ok(KNOWN_VARIANTS
        .iter()
        .map(|(id, label, priority, note)| ReleaseVariant {
            id: id.to_string(),
            label: label.to_string(),
            priority: *priority,
            note: note.to_string(),
        })
        .collect())
}

/// Fetch the latest llama.cpp releases from the GitHub Releases API.
/// Falls back to a curated list if the network is unavailable.
#[tauri::command]
pub async fn list_github_releases() -> Result<Vec<GitHubRelease>, String> {
    info!("Fetching latest llama.cpp releases from GitHub");

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(15))
        .user_agent("llama-launcher")
        .build()
        .map_err(|e| format!("HTTP client error: {}", e))?;

    let url = "https://api.github.com/repos/ggml-org/llama.cpp/releases?per_page=15";
    let response = client.get(url).send().await;

    let releases: Vec<GitHubRelease> = match response {
        Ok(resp) => {
            let status = resp.status();
            if !status.is_success() {
                warn!("GitHub API returned status: {}", status);
                return Ok(curated_releases());
            }
            let body: Vec<serde_json::Value> = match resp.json().await {
                Ok(b) => b,
                Err(e) => {
                    warn!("Failed to parse GitHub response: {}", e);
                    return Ok(curated_releases());
                }
            };

            let mut out = Vec::new();
            for rel in body {
                let tag = rel.get("tag_name").and_then(|v| v.as_str()).unwrap_or("unknown").to_string();
                let published_at = rel.get("published_at")
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string();
                let notes = rel.get("body").and_then(|v| v.as_str()).unwrap_or("").to_string();
                let html_url = rel.get("html_url").and_then(|v| v.as_str()).unwrap_or("").to_string();
                let commit = tag.clone();

                for (vid, _vlabel, vpriority, _vnote) in KNOWN_VARIANTS {
                    let asset_url = format!("{}/download/{}", html_url, vid);
                    out.push(GitHubRelease {
                        id: format!("r_{}_{}", tag, vid),
                        tag: tag.clone(),
                        published_at: published_at.clone(),
                        commit: commit.clone(),
                        notes: notes.clone(),
                        installed: false,
                        variant: vid.to_string(),
                        priority: *vpriority,
                        download_url: asset_url,
                        size_mb: if *vid == "cpu" { 18 } else if *vid == "cuda12" || *vid == "cuda13" { 42 } else { 28 },
                    });
                }
            }
            out
        }
        Err(e) => {
            warn!("Failed to fetch GitHub releases: {}", e);
            curated_releases()
        }
    };

    info!("Fetched {} llama.cpp releases from GitHub", releases.len());
    Ok(releases)
}

/// Detect system capabilities (GPU VRAM, RAM, CPU cores).
#[tauri::command]
pub async fn get_system_capabilities() -> Result<SystemCapabilities, String> {
    let mut sys = sysinfo::System::new_all();
    sys.refresh_all();

    let ram_gb = sys.total_memory() as f64 / (1024.0 * 1024.0 * 1024.0);
    let cpu_cores = num_cpus::get();

    // Try to detect NVIDIA GPU via nvidia-smi
    let (gpu_name, gpu_vram_gb, has_cuda) = detect_nvidia_gpu();

    let has_vulkan = std::path::Path::new("/usr/lib/x86_64-linux-gnu/libvulkan.so").exists()
        || std::path::Path::new("/usr/local/lib/libvulkan.dylib").exists()
        || cfg!(target_os = "windows");

    let has_metal = cfg!(target_os = "macos");

    Ok(SystemCapabilities {
        gpu_name,
        gpu_vram_gb,
        ram_gb,
        cpu_cores,
        has_cuda,
        has_vulkan,
        has_metal,
    })
}

fn detect_nvidia_gpu() -> (String, f64, bool) {
    let output = std::process::Command::new("nvidia-smi")
        .args(["--query-gpu=name,memory.total", "--format=csv,noheader,nounits"])
        .output();

    match output {
        Ok(out) if out.status.success() => {
            let stdout = String::from_utf8_lossy(&out.stdout);
            let first_line = stdout.lines().next().unwrap_or("");
            let parts: Vec<&str> = first_line.split(',').collect();
            if parts.len() >= 2 {
                let name = parts[0].trim().to_string();
                let vram_mb: f64 = parts[1].trim().parse().unwrap_or(0.0);
                return (name, vram_mb / 1024.0, true);
            }
        }
        _ => {}
    }

    ("CPU only".to_string(), 0.0, false)
}

/// Fallback curated release list when GitHub is unreachable.
fn curated_releases() -> Vec<GitHubRelease> {
    let tags = [
        ("b9951", "2026-07-10", "f3a2c81", "New Vulkan compute scheduler, KV cache eviction rewrite"),
        ("b9940", "2026-07-08", "c7e1d29", "CUDA 13 build fixes, --cache-type-q flag"),
        ("b9925", "2026-07-05", "8b4f602", "Speculative decoding improvements"),
        ("b9908", "2026-07-01", "2d9a157", "MoE expert offload to CPU, /v1/embeddings endpoint"),
        ("b9890", "2026-06-26", "e5c8043", "K-quants for DeepSeek V3, metrics endpoint"),
    ];

    let mut out = Vec::new();
    for (tag, date, commit, notes) in tags {
        for (vid, _vlabel, vpriority, _vnote) in KNOWN_VARIANTS {
            out.push(GitHubRelease {
                id: format!("r_{}_{}", tag, vid),
                tag: tag.to_string(),
                published_at: date.to_string(),
                commit: commit.to_string(),
                notes: notes.to_string(),
                installed: false,
                variant: vid.to_string(),
                priority: *vpriority,
                download_url: format!("https://github.com/ggml-org/llama.cpp/releases/download/{}/llama-{}-bin-{}-x64.zip", tag, tag, vid),
                size_mb: if *vid == "cpu" { 18 } else if *vid == "cuda12" || *vid == "cuda13" { 42 } else { 28 },
            });
        }
    }
    out
}
