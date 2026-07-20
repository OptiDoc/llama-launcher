use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Workspace {
    pub id: String,
    pub name: String,
    pub color: String,
    pub description: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkspaceSettings {
    pub hibernate_after_sec: u64,
    pub default_gpu_layers: i32,
    pub default_threads: usize,
    pub auto_calibrate: bool,
    pub max_concurrent_instances: usize,
}

impl Default for WorkspaceSettings {
    fn default() -> Self {
        Self {
            hibernate_after_sec: 75,
            default_gpu_layers: -1,
            default_threads: num_cpus::get(),
            auto_calibrate: true,
            max_concurrent_instances: 4,
        }
    }
}
