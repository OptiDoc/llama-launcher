use super::correlation::set_correlation_id;
use super::logger_types::{LogLevel, LogEntry};
use super::logger_state::LOGGER_STATE;
use super::logger_write::{current_timestamp_ms, push_to_queue};

#[tauri::command]
pub fn write_frontend_log(entry: LogEntry) {
    let mut state = match LOGGER_STATE.lock() {
        Ok(s) => s,
        Err(e) => {
            eprintln!("[LOGGER] Mutex poisoned in write_frontend_log: {}", e);
            return;
        }
    };
    let mut log_entry = entry;
    if log_entry.id == 0 {
        log_entry.id = state.next_log_id();
    }
    if log_entry.timestamp == 0 {
        log_entry.timestamp = current_timestamp_ms();
    }
    if let Some(ref id) = log_entry.correlation_id {
        set_correlation_id(id.clone());
    }
    super::logger_write::dispatch_log_entry(log_entry.clone(), &state);
    push_to_queue(&mut state, log_entry);
}

pub fn set_debug_mode(enabled: bool) {
    if let Ok(mut s) = LOGGER_STATE.lock() {
        s.debug_mode = enabled;
    }
}

pub fn set_full_log_mode(enabled: bool) {
    if let Ok(mut s) = LOGGER_STATE.lock() {
        s.full_log_mode = enabled;
    }
}

pub fn set_log_level(level: LogLevel) {
    if let Ok(mut s) = LOGGER_STATE.lock() {
        s.min_level = level;
    }
}
