use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicU64, Ordering};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum LogLevel {
    Debug,
    Info,
    Warn,
    Error,
}

impl LogLevel {
    pub fn as_str(&self) -> &'static str {
        match self {
            LogLevel::Debug => "DEBUG",
            LogLevel::Info => "INFO",
            LogLevel::Warn => "WARN",
            LogLevel::Error => "ERROR",
        }
    }

    pub fn as_numeric(&self) -> i32 {
        match self {
            LogLevel::Debug => 0,
            LogLevel::Info => 1,
            LogLevel::Warn => 2,
            LogLevel::Error => 3,
        }
    }

    pub fn from_str_case_insensitive(s: &str) -> Self {
        match s.to_lowercase().as_str() {
            "debug" => LogLevel::Debug,
            "info" | "success" => LogLevel::Info,
            "warn" | "warning" => LogLevel::Warn,
            "error" => LogLevel::Error,
            _ => LogLevel::Info,
        }
    }
}

impl std::fmt::Display for LogLevel {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.as_str())
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LogEntry {
    pub id: u64,
    pub timestamp: u64,
    pub level: LogLevel,
    pub category: String,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub context: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tag: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub stack: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub correlation_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MeasureEntry {
    pub correlation_id: Option<String>,
    pub category: String,
    pub duration_ms: u64,
}

#[derive(Debug)]
pub struct LoggerState {
    pub logs: std::collections::VecDeque<LogEntry>,
    pub debug_mode: bool,
    pub full_log_mode: bool,
    pub min_level: LogLevel,
    pub next_id: AtomicU64,
}

const MAX_LOGS: usize = 10_000;

impl Default for LoggerState {
    fn default() -> Self {
        Self::new()
    }
}

impl LoggerState {
    pub fn new() -> Self {
        Self {
            logs: std::collections::VecDeque::with_capacity(MAX_LOGS),
            debug_mode: false,
            full_log_mode: true,
            min_level: LogLevel::Info,
            next_id: AtomicU64::new(1),
        }
    }

    pub fn next_log_id(&self) -> u64 {
        self.next_id.fetch_add(1, Ordering::Relaxed)
    }
}
