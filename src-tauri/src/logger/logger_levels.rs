use std::time::{SystemTime, UNIX_EPOCH};

use super::logger_types::{LogLevel, LogEntry};
use super::logger_write::{generate_log_id, log_entry};

pub fn debug(message: &str, category: &str, context: Option<serde_json::Value>) {
    let entry = LogEntry {
        id: generate_log_id(),
        timestamp: SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as u64,
        level: LogLevel::Debug,
        category: category.to_string(),
        message: message.to_string(),
        context,
        stack: None,
        duration_ms: None,
    };
    log_entry(entry);
}

pub fn info(message: &str, category: &str, context: Option<serde_json::Value>) {
    let entry = LogEntry {
        id: generate_log_id(),
        timestamp: SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as u64,
        level: LogLevel::Info,
        category: category.to_string(),
        message: message.to_string(),
        context,
        stack: None,
        duration_ms: None,
    };
    log_entry(entry);
}

pub fn success(message: &str, category: &str, context: Option<serde_json::Value>) {
    let entry = LogEntry {
        id: generate_log_id(),
        timestamp: SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as u64,
        level: LogLevel::Success,
        category: category.to_string(),
        message: message.to_string(),
        context,
        stack: None,
        duration_ms: None,
    };
    log_entry(entry);
}

pub fn warn(message: &str, category: &str, context: Option<serde_json::Value>) {
    let entry = LogEntry {
        id: generate_log_id(),
        timestamp: SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as u64,
        level: LogLevel::Warn,
        category: category.to_string(),
        message: message.to_string(),
        context,
        stack: None,
        duration_ms: None,
    };
    log_entry(entry);
}

pub fn error(message: &str, category: &str, context: Option<serde_json::Value>) {
    let entry = LogEntry {
        id: generate_log_id(),
        timestamp: SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as u64,
        level: LogLevel::Error,
        category: category.to_string(),
        message: message.to_string(),
        context,
        stack: None,
        duration_ms: None,
    };
    log_entry(entry);
}

pub fn measure<F, T>(message: &str, category: &str, f: F) -> T 
where
    F: FnOnce() -> T,
{
    let start = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64;
    
    let result = f();
    
    let duration = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
        - start;
    
    info(&format!("{} - {}ms", message, duration), category, None);
    
    result
}
