use std::time::{SystemTime, UNIX_EPOCH};

use super::logger_types::{LogLevel, LogEntry};
use super::logger_state::LOGGER_STATE;

pub fn get_recent_logs(limit: usize) -> Vec<LogEntry> {
    let state = match LOGGER_STATE.lock() {
        Ok(s) => s,
        Err(e) => {
            eprintln!("[LOGGER] Mutex poisoned in get_recent_logs: {}", e);
            return Vec::new();
        }
    };
    state.logs.iter().cloned().rev().take(limit).rev().collect()
}

#[tauri::command]
pub fn clear_logs() {
    let mut state = match LOGGER_STATE.lock() {
        Ok(s) => s,
        Err(e) => {
            eprintln!("[LOGGER] Mutex poisoned in clear_logs: {}", e);
            return;
        }
    };
    state.logs.clear();
}

#[tauri::command]
pub fn clear_logs_by_level(level: LogLevel) {
    let mut state = match LOGGER_STATE.lock() {
        Ok(s) => s,
        Err(e) => {
            eprintln!("[LOGGER] Mutex poisoned in clear_logs_by_level: {}", e);
            return;
        }
    };
    state.logs.retain(|e| e.level != level);
}

#[tauri::command(rename = "export_logs_by_level")]
pub fn export_logs_by_level(level: LogLevel) -> String {
    let state = match LOGGER_STATE.lock() {
        Ok(s) => s,
        Err(e) => {
            eprintln!("[LOGGER] Mutex poisoned in export_logs_by_level: {}", e);
            return "{}".to_string();
        }
    };
    let logs: Vec<serde_json::Value> = state.logs.iter().filter(|e| e.level == level).map(|entry| {
        serde_json::to_value(entry).unwrap_or_default()
    }).collect();
    
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis();
    
    let export = serde_json::json!({
        "level": level,
        "exported_at": timestamp,
        "count": logs.len(),
        "logs": logs,
    });
    
    serde_json::to_string_pretty(&export).unwrap_or_default()
}

pub fn export_logs() -> String {
    let state = match LOGGER_STATE.lock() {
        Ok(s) => s,
        Err(e) => {
            eprintln!("[LOGGER] Mutex poisoned in export_logs: {}", e);
            return "{}".to_string();
        }
    };
    let logs: Vec<serde_json::Value> = state.logs.iter().map(|entry| {
        serde_json::to_value(entry).unwrap_or_default()
    }).collect();
    
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis();
    
    let export = serde_json::json!({
        "exported_at": timestamp,
        "logs": logs,
    });
    
    serde_json::to_string_pretty(&export).unwrap_or_default()
}
