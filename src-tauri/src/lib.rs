#![cfg_attr(
    target_os = "windows",
    windows_subsystem = "windows"
)]

pub mod core;
pub mod commands;
pub mod llama;
pub mod models;
pub mod processes;
pub mod system;
pub mod updater;
pub mod workspaces;
pub mod releases;

pub use core::*;
use log::LevelFilter;
use tauri::Manager;

pub fn run() {
    tracing::info!("Starting llama-launcher v{}", env!("CARGO_PKG_VERSION"));

    tauri::Builder::default()
        .plugin(
            tauri_plugin_log::Builder::new()
                .targets([
                    tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::Stdout),
                    tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::LogDir {
                        file_name: Some("llama-launcher".into()),
                    }),
                ])
                .level(LevelFilter::Info)
                .build(),
        )
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_focus();
                let _ = window.unminimize();
                let _ = window.show();
            }
        }))
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .manage(AppState::default())
        .invoke_handler(tauri::generate_handler![
            commands::scan_models,
            commands::get_model_info,
            commands::delete_model,
            commands::download_model,
            commands::verify_model,
            commands::start_model,
            commands::stop_model,
            commands::restart_model,
            commands::get_process_status,
            commands::list_processes,
            commands::get_process_metrics,
            commands::get_system_info,
            commands::get_gpu_info,
            commands::detect_llama_binary,
            commands::get_config,
            commands::update_config,
            commands::run_benchmark,
            commands::open_model_folder,
            commands::select_model_file,
            commands::serve_model_file,
            commands::serve_asset_file,
            // Workspace management
            workspaces::list_workspaces,
            workspaces::create_workspace,
            workspaces::update_workspace,
            workspaces::delete_workspace,
            workspaces::get_active_workspace,
            workspaces::set_active_workspace,
            workspaces::get_workspace_settings,
            workspaces::update_workspace_settings,
            // Releases & system capabilities
            releases::list_release_variants,
            releases::list_github_releases,
            releases::get_system_capabilities,
            // Process console output
            commands::get_process_stdout,
        ])
        .setup(|app| {
            if let Some(window) = app.get_webview_window("main") {
                let handle = window.clone();
                window.on_window_event(move |event| {
                    if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                        api.prevent_close();
                        let _ = handle.hide();
                    }
                });
                let _ = window.show();
                let _ = window.set_focus();
            }

            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|_app_handle, event| {
            if let tauri::RunEvent::ExitRequested { api, .. } = event {
                api.prevent_exit();
            }
        });
}

use parking_lot::{Mutex as PLMutex, RwLock};
use std::collections::HashMap;

#[derive(Debug)]
pub struct AppState {
    pub models: RwLock<HashMap<String, ModelInfo>>,
    pub processes: PLMutex<HashMap<String, ProcessInfo>>,
    pub config: RwLock<AppConfig>,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            models: RwLock::new(HashMap::new()),
            processes: PLMutex::new(HashMap::new()),
            config: RwLock::new(AppConfig::default()),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_config_default() {
        let config = AppConfig::default();
        assert_eq!(config.default_context_size, 8192);
    }
}
