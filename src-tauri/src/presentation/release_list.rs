use crate::{log_info, log_warn, GitHubRelease, ReleaseVariant};

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

#[tauri::command]
pub async fn list_github_releases() -> Result<Vec<GitHubRelease>, String> {
    log_info!("Fetching latest llama.cpp releases from GitHub", "releases");

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
                log_warn!(&format!("GitHub API returned status: {}", status), "releases");
                return Ok(curated_releases());
            }
            let body: Vec<serde_json::Value> = match resp.json().await {
                Ok(b) => b,
                Err(e) => {
                    log_warn!(&format!("Failed to parse GitHub response: {}", e), "releases");
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
            log_warn!(&format!("Failed to fetch GitHub releases: {}", e), "releases");
            curated_releases()
        }
    };

    log_info!(&format!("Fetched {} llama.cpp releases from GitHub", releases.len()), "releases");
    Ok(releases)
}

pub fn variant_to_asset_name(tag: &str, variant: &str) -> String {
    format!("llama-{}-bin-{}-x64.zip", tag, variant)
}

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
