#![cfg_attr(
    target_os = "windows",
    windows_subsystem = "windows"
)]

pub mod domain;
pub mod application;
pub mod presentation;
pub mod processes;
pub mod logger;

pub use domain::*;
use log::LevelFilter;
use tauri::Manager;
use tauri_plugin_store::StoreExt;
use application::AppState;

pub fn run() {
    crate::log_info!(&format!("Starting llama-launcher v{}", env!("CARGO_PKG_VERSION")), "startup");

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
                .add_migrations("sqlite:llama-launcher.db", application::get_migrations())
                .build(),
        )
        .manage(AppState::new())
        .invoke_handler(tauri::generate_handler![
            presentation::scan_models,
            presentation::get_model_info,
            presentation::delete_model,
            presentation::download_model,
            presentation::verify_model,
            presentation::start_model,
            presentation::stop_model,
            presentation::restart_model,
            presentation::get_process_status,
            presentation::list_processes,
            presentation::get_process_metrics,
            presentation::get_system_info,
            presentation::get_gpu_info,
            presentation::detect_llama_binary,
            presentation::get_config,
            presentation::update_config,
            presentation::run_benchmark,
            presentation::open_model_folder,
            presentation::select_model_file,
            presentation::serve_model_file,
            presentation::serve_asset_file,
            presentation::select_directory,
            presentation::list_workspaces,
            presentation::create_workspace,
            presentation::update_workspace,
            presentation::delete_workspace,
            presentation::get_active_workspace,
            presentation::set_active_workspace,
            presentation::get_workspace_settings,
            presentation::update_workspace_settings,
            presentation::list_release_variants,
            presentation::list_github_releases,
            presentation::get_system_capabilities,
            presentation::get_process_stdout,
            presentation::ensure_app_dir,
            presentation::download_file,
            presentation::cancel_download,
            presentation::install_release,
            presentation::extract_zip,
            presentation::download_cuda_libs,
            presentation::scan_external_models,
            presentation::sync_external_models,
            logger::clear_logs,
            logger::clear_logs_by_level,
            logger::export_logs_by_level,
            logger::write_frontend_log,
        ])
        .setup(|app| {
            logger::init_logger();

            let state = app.state::<AppState>();
            if let Ok(store) = app.store("config.json") {
                if let Some(val) = store.get("config") {
                    if let Ok(saved_config) = serde_json::from_value::<AppConfig>(val.clone()) {
                        *state.config.write() = saved_config;
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

            use tauri::tray::TrayIconBuilder;
            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().cloned().unwrap_or_else(|| {
                    log_warn!("No default window icon found — tray icon will be empty", "startup");
                    tauri::image::Image::new_owned(vec![0u8; 4], 1, 1)
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

            let pm = app.state::<AppState>().inner().process_manager.clone();
            tauri::async_runtime::spawn(async move {
                loop {
                    tokio::time::sleep(std::time::Duration::from_secs(2)).await;
                    pm.update_metrics();
                    pm.cleanup();
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
