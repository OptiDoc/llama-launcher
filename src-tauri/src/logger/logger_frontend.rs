use std::fs;
use std::io::Write;
use std::time::{SystemTime, UNIX_EPOCH};

use serde::Deserialize;

use super::logger_types::{LogLevel, LogEntry};
use super::logger_state::LOGGER_STATE;
use super::logger_write::{format_full, generate_log_id};

#[derive(Debug, Clone, Deserialize)]
pub struct FrontendLogEntry {
    pub level: String,
    pub category: String,
    pub message: String,
}

#[tauri::command]
pub fn write_frontend_log(entry: FrontendLogEntry) {
    let level = match entry.level.to_lowercase().as_str() {
        "debug" => LogLevel::Debug,
        "info" => LogLevel::Info,
        "success" => LogLevel::Success,
        "warn" => LogLevel::Warn,
        "error" => LogLevel::Error,
        _ => LogLevel::Info,
    };
    let log_entry = LogEntry {
        id: generate_log_id(),
        timestamp: SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as u64,
        level,
        category: entry.category,
        message: entry.message,
        context: None,
        stack: None,
        duration_ms: None,
    };
    
    let full_log_mode = match LOGGER_STATE.lock() {
        Ok(state) => state.full_log_mode,
        Err(e) => {
            eprintln!("[LOGGER] Mutex poisoned in write_frontend_log: {}", e);
            true
        }
    };
    
    if full_log_mode {
        let log_dir = if cfg!(windows) {
            std::env::var("USERPROFILE").map(|p| std::path::PathBuf::from(p).join(".llama-launcher").join("logs"))
        } else {
            std::env::var("HOME").map(|p| std::path::PathBuf::from(p).join(".llama-launcher").join("logs"))
        };
        if let Ok(dir) = log_dir {
            if let Err(e) = fs::create_dir_all(&dir) {
                eprintln!("[LOGGER] write_frontend_log: failed to create dir {}: {}", dir.display(), e);
            }
            let log_file = dir.join(match log_entry.level {
                LogLevel::Debug => "debug.log",
                LogLevel::Info => "info.log",
                LogLevel::Success => "success.log",
                LogLevel::Warn => "warn.log",
                LogLevel::Error => "error.log",
            });
            match fs::OpenOptions::new()
                .create(true)
                .append(true)
                .open(&log_file)
            {
                Ok(mut file) => {
                    if let Err(e) = file.write_all(format!("{}\n", format_full(&log_entry)).as_bytes()) {
                        eprintln!("[LOGGER] write_frontend_log: failed to write to {}: {}", log_file.display(), e);
                    }
                }
                Err(e) => {
                    eprintln!("[LOGGER] write_frontend_log: failed to open {}: {}", log_file.display(), e);
                }
            }
        } else if let Err(e) = log_dir {
            eprintln!("[LOGGER] write_frontend_log: failed to get log dir: {}", e);
        }
    }
}

pub fn set_debug_mode(enabled: bool) {
    let mut state = match LOGGER_STATE.lock() {
        Ok(s) => s,
        Err(e) => {
            eprintln!("[LOGGER] Mutex poisoned in set_debug_mode: {}", e);
            return;
        }
    };
    state.debug_mode = enabled;
}

pub fn set_full_log_mode(enabled: bool) {
    let mut state = match LOGGER_STATE.lock() {
        Ok(s) => s,
        Err(e) => {
            eprintln!("[LOGGER] Mutex poisoned in set_full_log_mode: {}", e);
            return;
        }
    };
    state.full_log_mode = enabled;
}

pub fn set_log_level(level: LogLevel) {
    let mut state = match LOGGER_STATE.lock() {
        Ok(s) => s,
        Err(e) => {
            eprintln!("[LOGGER] Mutex poisoned in set_log_level: {}", e);
            return;
        }
    };
    state.min_level = level;
}
