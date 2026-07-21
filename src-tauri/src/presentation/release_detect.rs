use crate::SystemCapabilities;
use super::release_gpu::{detect_amd_gpu, detect_intel_gpu, detect_nvidia_gpu, detect_vulkan};

#[tauri::command]
pub async fn get_system_capabilities() -> Result<SystemCapabilities, String> {
    let mut sys = sysinfo::System::new_all();
    sys.refresh_all();

    let ram_gb = sys.total_memory() as f64 / (1024.0 * 1024.0 * 1024.0);
    let cpu_name = sys.cpus().first().map(|c| c.brand().to_string()).unwrap_or_default();
    let cpu_cores = num_cpus::get();
    let os_name = sysinfo::System::name().unwrap_or_default();

    let disks = sysinfo::Disks::new_with_refreshed_list();
    let disk_free_gb = disks.iter()
        .next()
        .map(|d| d.available_space() as f64 / (1024.0 * 1024.0 * 1024.0))
        .unwrap_or(0.0);

    let (gpu_name, gpu_vram_gb, has_cuda) = detect_nvidia_gpu().await;
    let (amd_name, amd_vram, has_rocm) = if has_cuda {
        (String::new(), 0.0, false)
    } else {
        detect_amd_gpu().await
    };
    let (intel_name, intel_vram) = if has_cuda || has_rocm {
        (String::new(), 0.0)
    } else {
        detect_intel_gpu()
    };

    let (final_name, final_vram, final_vendor) = if !gpu_name.is_empty() {
        (gpu_name, gpu_vram_gb, "nvidia".to_string())
    } else if !amd_name.is_empty() {
        (amd_name, amd_vram, "amd".to_string())
    } else if !intel_name.is_empty() {
        (intel_name, intel_vram, "intel".to_string())
    } else {
        ("CPU only".to_string(), 0.0, "none".to_string())
    };

    let has_vulkan = detect_vulkan();
    let has_metal = cfg!(target_os = "macos");

    Ok(SystemCapabilities {
        gpu_name: final_name,
        gpu_vram_gb: final_vram,
        gpu_vendor: final_vendor,
        ram_gb,
        cpu_name,
        cpu_cores,
        has_cuda,
        has_vulkan,
        has_metal,
        has_rocm,
        disk_free_gb,
        os_name,
    })
}
