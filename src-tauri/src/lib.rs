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
pub mod logger;

pub use core::*;
use log::LevelFilter;
use tauri::Manager;
use tauri_plugin_store::StoreExt;

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
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:llama-launcher.db", core::get_migrations())
                .build(),
        )
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
            commands::select_directory,
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
            // App directory
            commands::ensure_app_dir,
            // File download
            commands::download_file,
            commands::cancel_download,
            // Release install (download + extract + CUDA libs)
            commands::install_release,
            commands::extract_zip,
            commands::download_cuda_libs,
            // External models discovery
            commands::scan_external_models,
            commands::sync_external_models,
            // Logs
            logger::clear_logs,
            logger::clear_logs_by_level,
            logger::export_logs_by_level,
        ])
        .setup(|app| {
            // Initialize logger
            logger::init_logger();
            
            // Load saved config from store on startup
            if let Ok(store) = app.store("config.json") {
                if let Some(val) = store.get("config") {
                    if let Ok(saved_config) = serde_json::from_value::<crate::AppConfig>(val.clone()) {
                        *core::GLOBAL_STATE.config.write() = saved_config;
                    }
                }
            }

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

            // System tray with Quit menu item
            use tauri::tray::TrayIconBuilder;
            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().cloned().unwrap_or_else(|| {
                    todo!("No default icon")
                }))
                .menu(&tauri::menu::MenuBuilder::new(app)
                    .item(&tauri::menu::MenuItemBuilder::new("Quit")
                        .id("quit")
                        .accelerator("CmdOrCtrl+Q")
                        .build(app)
                        .unwrap())
                    .build()
                    .unwrap())
                .on_menu_event(move |app, event| {
                    if event.id() == "quit" {
                        app.exit(0);
                    }
                })
                .on_tray_icon_event(|tray, event| {
                    if let tauri::tray::TrayIconEvent::DoubleClick { .. } = event {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                })
                .build(app)
                .unwrap();

            // Start background metrics updater — refreshes CPU/memory for
            // all running llama-server processes every 2 seconds.
            tauri::async_runtime::spawn(async move {
                loop {
                    tokio::time::sleep(std::time::Duration::from_secs(2)).await;
                    crate::processes::process_manager().update_metrics();
                    crate::processes::process_manager().cleanup();
                }
            });

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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_config_default() {
        let config = AppConfig::default();
        assert_eq!(config.default_context_size, 8192);
    }
}
