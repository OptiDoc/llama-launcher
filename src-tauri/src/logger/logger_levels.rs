use super::correlation::get_correlation_id;
use super::logger_types::{LogLevel, LogEntry, LoggerState, MeasureEntry};
use super::logger_state::LOGGER_STATE;
use super::logger_write::{current_correlation_id, current_timestamp_ms, dispatch_log_entry};

fn with_state<T, F: FnOnce(&LoggerState) -> T>(f: F) -> T {
    let state = LOGGER_STATE.lock().unwrap_or_else(|e| {
        eprintln!("[LOGGER] Mutex poisoned: {}", e);
        panic!("[LOGGER] Mutex poisoned, aborting");
    });
    f(&state)
}

fn with_state_mut<T, F: FnOnce(&mut LoggerState) -> T>(f: F) -> T {
    let mut state = LOGGER_STATE.lock().unwrap_or_else(|e| {
        eprintln!("[LOGGER] Mutex poisoned: {}", e);
        panic!("[LOGGER] Mutex poisoned, aborting");
    });
    f(&mut state)
}

fn emit(entry: LogEntry, state: &LoggerState) {
    super::logger_write::dispatch_log_entry(entry, state);
}

fn emit_and_queue(entry: LogEntry, state: &mut LoggerState) {
    super::logger_write::dispatch_log_entry(entry.clone(), state);
    super::logger_write::push_to_queue(state, entry);
}

pub fn debug(message: &str, category: &str, context: Option<serde_json::Value>) {
    with_state(|state| {
        let entry = LogEntry {
            id: state.next_log_id(),
            timestamp: current_timestamp_ms(),
            level: LogLevel::Debug,
            category: category.to_string(),
            message: message.to_string(),
            context,
            tag: None,
            stack: None,
            correlation_id: get_correlation_id(),
        };
        emit(entry, state);
    });
}

pub fn info(message: &str, category: &str, context: Option<serde_json::Value>) {
    with_state_mut(|state| {
        let entry = LogEntry {
            id: state.next_log_id(),
            timestamp: current_timestamp_ms(),
            level: LogLevel::Info,
            category: category.to_string(),
            message: message.to_string(),
            context,
            tag: None,
            stack: None,
            correlation_id: get_correlation_id(),
        };
        emit_and_queue(entry, state);
    });
}

pub fn warn(message: &str, category: &str, context: Option<serde_json::Value>) {
    with_state_mut(|state| {
        let entry = LogEntry {
            id: state.next_log_id(),
            timestamp: current_timestamp_ms(),
            level: LogLevel::Warn,
            category: category.to_string(),
            message: message.to_string(),
            context,
            tag: None,
            stack: None,
            correlation_id: get_correlation_id(),
        };
        emit_and_queue(entry, state);
    });
}

pub fn error(message: &str, category: &str, context: Option<serde_json::Value>) {
    with_state_mut(|state| {
        let mut entry = LogEntry {
            id: state.next_log_id(),
            timestamp: current_timestamp_ms(),
            level: LogLevel::Error,
            category: category.to_string(),
            message: message.to_string(),
            context,
            tag: None,
            stack: None,
            correlation_id: get_correlation_id(),
        };
        entry.stack = Some(std::backtrace::Backtrace::capture().to_string());
        emit_and_queue(entry, state);
    });
}

pub fn measure<F, T>(message: &str, category: &str, f: F) -> T
where
    F: FnOnce() -> T,
{
    let start = current_timestamp_ms();
    let result = f();
    let duration = current_timestamp_ms() - start;

    let measure_entry = MeasureEntry {
        correlation_id: current_correlation_id(),
        category: category.to_string(),
        duration_ms: duration,
    };

    let log_msg = format!("{} - {}ms", message, duration);
    with_state_mut(|state| {
        let log_entry = LogEntry {
            id: state.next_log_id(),
            timestamp: current_timestamp_ms(),
            level: LogLevel::Info,
            category: category.to_string(),
            message: log_msg,
            context: Some(serde_json::to_value(&measure_entry).unwrap_or_default()),
            tag: Some("measure".to_string()),
            stack: None,
            correlation_id: current_correlation_id(),
        };
        dispatch_log_entry(log_entry, state);
    });

    result
}
