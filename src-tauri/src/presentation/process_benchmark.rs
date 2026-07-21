
use tauri::AppHandle;

use crate::application::AppState;
use crate::domain::{BenchmarkConfig, BenchmarkResult};
use crate::processes::BenchmarkRunner;

#[tauri::command]
pub async fn run_benchmark(
    state: tauri::State<'_, AppState>,
    _app: AppHandle,
    model_id: String,
    model_path: String,
    config: BenchmarkConfig,
) -> Result<BenchmarkResult, String> {
    let runner = BenchmarkRunner::new(state.process_manager.clone());

    runner.run(config, model_id.clone(), std::path::PathBuf::from(&model_path))
        .await
        .map_err(|e| e.to_string())
}
