use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReleaseVariant {
    pub id: String,
    pub label: String,
    pub priority: bool,
    pub note: String,
}

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

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemCapabilities {
    pub gpu_name: String,
    pub gpu_vram_gb: f64,
    pub gpu_vendor: String,
    pub ram_gb: f64,
    pub cpu_name: String,
    pub cpu_cores: usize,
    pub has_cuda: bool,
    pub has_vulkan: bool,
    pub has_metal: bool,
    pub has_rocm: bool,
    pub disk_free_gb: f64,
    pub os_name: String,
}
