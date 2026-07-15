use serde::{Deserialize, Serialize};
use std::collections::VecDeque;
use std::fs;
use std::sync::{Arc, Mutex};
use std::time::{SystemTime, UNIX_EPOCH};
use std::io::Write;

// ---------- Types ----------

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum LogLevel {
    Debug,
    Info,
    Success,
    Warn,
    Error,
}

impl std::fmt::Display for LogLevel {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            LogLevel::Debug => write!(f, "DEBUG"),
            LogLevel::Info => write!(f, "INFO"),
            LogLevel::Success => write!(f, "SUCCESS"),
            LogLevel::Warn => write!(f, "WARN"),
            LogLevel::Error => write!(f, "ERROR"),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LogEntry {
    pub id: String,
    pub timestamp: u64,
    pub level: LogLevel,
    pub category: String,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub context: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub stack: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub duration_ms: Option<u64>,
}

// ---------- Logger State ----------

const MAX_LOGS: usize = 10000;

#[derive(Debug)]
pub struct LoggerState {
    logs: VecDeque<LogEntry>,
    debug_mode: bool,
    full_log_mode: bool,
    min_level: LogLevel,
}

impl LoggerState {
    pub fn new() -> Self {
        Self {
            logs: VecDeque::with_capacity(MAX_LOGS),
            debug_mode: false,
            full_log_mode: true,
            min_level: LogLevel::Info,
        }
    }
}

// Global logger state
static LOGGER_STATE: once_cell::sync::Lazy<Arc<Mutex<LoggerState>>> = 
    once_cell::sync::Lazy::new(|| {
        Arc::new(Mutex::new(LoggerState::new()))
    });

// ---------- Logger Implementation ----------

pub fn init_logger() {
    // Initialize logger on app start
    tracing::info!("Logger initialized");
}

pub fn get_logger_state() -> Arc<Mutex<LoggerState>> {
    LOGGER_STATE.clone()
}

// Generate unique log ID
fn generate_log_id() -> String {
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_nanos();
    format!("log_{}_{}", now, rand::random::<u64>())
}

// Format message for console (short format)
fn format_console(entry: &LogEntry) -> String {
    let timestamp = entry.timestamp;
    let secs = timestamp / 1000;
    let millis = timestamp % 1000;
    
    let time = format!("{:02}:{:02}:{:02}.{:03}", 
        (secs / 3600) % 24,
        (secs / 60) % 60,
        secs % 60,
        millis);
    
    let level_color = match entry.level {
        LogLevel::Debug => "\x1b[36m", // Cyan
        LogLevel::Info => "\x1b[32m",  // Green
        LogLevel::Success => "\x1b[32m", // Green
        LogLevel::Warn => "\x1b[33m",  // Yellow
        LogLevel::Error => "\x1b[31m",  // Red
    };
    
    let reset = "\x1b[0m";
    let category = if entry.category.is_empty() {
        String::new()
    } else {
        format!("({})", entry.category)
    };
    
    format!(
        "{}[{}]{} {}{} {}",
        level_color,
        entry.level,
        reset,
        time,
        category,
        entry.message
    )
}

// Format message for detailed view (full format)
fn format_full(entry: &LogEntry) -> String {
    let timestamp = entry.timestamp;
    let secs = timestamp / 1000;
    let millis = timestamp % 1000;
    
    let time = format!("{:02}:{:02}:{:02}.{:03}", 
        (secs / 3600) % 24,
        (secs / 60) % 60,
        secs % 60,
        millis);
    
    let context_str = entry.context.as_ref().map(|c| {
        format!("\n  Context: {}", serde_json::to_string_pretty(c).unwrap_or_default())
    }).unwrap_or_default();
    let stack_str = entry.stack.as_ref().map(|s| {
        format!("\n  Stack: {}", s)
    }).unwrap_or_default();
    let duration_str = entry.duration_ms.map(|d| {
        format!("\n  Duration: {}ms", d)
    }).unwrap_or_default();
    
    format!(
        "[{}] [{}] ({}) {}{}{}{}",
        time, entry.level, entry.category, entry.message, context_str, stack_str, duration_str
    )
}

// Log entry
fn log_entry(entry: LogEntry) {
    let mut state = LOGGER_STATE.lock().unwrap();
    
    // Check if we should log based on level
    let should_log = match (&entry.level, &state.min_level) {
        (LogLevel::Debug, _) => state.debug_mode,
        (LogLevel::Info | LogLevel::Success, _) => true,
        (LogLevel::Warn | LogLevel::Error, _) => true,
    };
    
    if !should_log && entry.level != LogLevel::Error && entry.level != LogLevel::Warn {
        return;
    }
    
    // Store log
    state.logs.push_back(entry.clone());
    if state.logs.len() > MAX_LOGS {
        state.logs.pop_front();
    }
    
    // Output to console (short format)
    println!("{}", format_console(&entry));
    
    // Log to level-specific files if enabled
    if state.full_log_mode {
        // Use C:\Users\<Username>\.llama-launcher\logs on Windows
        let log_dir = if cfg!(windows) {
            std::env::var("USERPROFILE").map(|p| std::path::PathBuf::from(p).join(".llama-launcher").join("logs"))
        } else {
            std::env::var("HOME").map(|p| std::path::PathBuf::from(p).join(".llama-launcher").join("logs"))
        };
        
        if let Ok(dir) = log_dir {
            let _ = fs::create_dir_all(&dir);
            let log_file = dir.join(match entry.level {
                LogLevel::Debug => "debug.log",
                LogLevel::Info => "info.log",
                LogLevel::Success => "success.log",
                LogLevel::Warn => "warn.log",
                LogLevel::Error => "error.log",
            });
            if let Ok(mut file) = fs::OpenOptions::new()
                .create(true)
                .append(true)
                .open(&log_file)
            {
                let _ = file.write_all(format!("{}\n", format_full(&entry)).as_bytes());
            }
        }
    }
}

// Log levels
pub fn debug(message: &str, category: &str, context: Option<serde_json::Value>) {
    let entry = LogEntry {
        id: generate_log_id(),
        timestamp: SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
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
            .unwrap()
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
            .unwrap()
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
            .unwrap()
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
            .unwrap()
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

// Measure execution time
pub fn measure<F, T>(message: &str, category: &str, f: F) -> T 
where
    F: FnOnce() -> T,
{
    let start = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_millis() as u64;
    
    let result = f();
    
    let duration = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_millis() as u64
        - start;
    
    info(&format!("{} - {}ms", message, duration), category, None);
    
    result
}

// Get recent logs
pub fn get_recent_logs(limit: usize) -> Vec<LogEntry> {
    let state = LOGGER_STATE.lock().unwrap();
    state.logs.iter().cloned().rev().take(limit).rev().collect()
}

// Clear all logs
#[tauri::command]
pub fn clear_logs() {
    let mut state = LOGGER_STATE.lock().unwrap();
    state.logs.clear();
}

// Clear logs by level
#[tauri::command]
pub fn clear_logs_by_level(level: LogLevel) {
    let mut state = LOGGER_STATE.lock().unwrap();
    state.logs.retain(|e| e.level != level);
}

// Export logs by level
#[tauri::command(rename = "export_logs_by_level")]
pub fn export_logs_by_level(level: LogLevel) -> String {
    let state = LOGGER_STATE.lock().unwrap();
    let logs: Vec<serde_json::Value> = state.logs.iter().filter(|e| e.level == level).map(|entry| {
        serde_json::to_value(entry).unwrap_or_default()
    }).collect();
    
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_millis();
    
    let export = serde_json::json!({
        "level": level,
        "exported_at": timestamp,
        "count": logs.len(),
        "logs": logs,
    });
    
    serde_json::to_string_pretty(&export).unwrap_or_default()
}

// Export logs
pub fn export_logs() -> String {
    let state = LOGGER_STATE.lock().unwrap();
    let logs: Vec<serde_json::Value> = state.logs.iter().map(|entry| {
        serde_json::to_value(entry).unwrap_or_default()
    }).collect();
    
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_millis();
    
    let export = serde_json::json!({
        "exported_at": timestamp,
        "logs": logs,
    });
    
    serde_json::to_string_pretty(&export).unwrap_or_default()
}

// Toggle debug mode
pub fn set_debug_mode(enabled: bool) {
    let mut state = LOGGER_STATE.lock().unwrap();
    state.debug_mode = enabled;
}

// Toggle full log mode
pub fn set_full_log_mode(enabled: bool) {
    let mut state = LOGGER_STATE.lock().unwrap();
    state.full_log_mode = enabled;
}

// Set log level
pub fn set_log_level(level: LogLevel) {
    let mut state = LOGGER_STATE.lock().unwrap();
    state.min_level = level;
}

// Helper macros
#[macro_export]
macro_rules! log_debug {
    ($message:expr) => {
        crate::logger::debug($message, "system", None)
    };
    ($message:expr, $category:expr) => {
        crate::logger::debug($message, $category, None)
    };
    ($message:expr, $category:expr, $context:expr) => {
        crate::logger::debug($message, $category, Some($context))
    };
}

#[macro_export]
macro_rules! log_info {
    ($message:expr) => {
        crate::logger::info($message, "system", None)
    };
    ($message:expr, $category:expr) => {
        crate::logger::info($message, $category, None)
    };
    ($message:expr, $category:expr, $context:expr) => {
        crate::logger::info($message, $category, Some($context))
    };
}

#[macro_export]
macro_rules! log_success {
    ($message:expr) => {
        crate::logger::success($message, "system", None)
    };
    ($message:expr, $category:expr) => {
        crate::logger::success($message, $category, None)
    };
    ($message:expr, $category:expr, $context:expr) => {
        crate::logger::success($message, $category, Some($context))
    };
}

#[macro_export]
macro_rules! log_warn {
    ($message:expr) => {
        crate::logger::warn($message, "system", None)
    };
    ($message:expr, $category:expr) => {
        crate::logger::warn($message, $category, None)
    };
    ($message:expr, $category:expr, $context:expr) => {
        crate::logger::warn($message, $category, Some($context))
    };
}

#[macro_export]
macro_rules! log_error {
    ($message:expr) => {
        crate::logger::error($message, "system", None)
    };
    ($message:expr, $category:expr) => {
        crate::logger::error($message, $category, None)
    };
    ($message:expr, $category:expr, $context:expr) => {
        crate::logger::error($message, $category, Some($context))
    };
}
