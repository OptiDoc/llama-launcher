use serde::{Deserialize, Serialize};

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

const MAX_LOGS: usize = 10000;

#[derive(Debug)]
pub struct LoggerState {
    pub logs: std::collections::VecDeque<LogEntry>,
    pub debug_mode: bool,
    pub full_log_mode: bool,
    pub min_level: LogLevel,
}

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
        }
    }
}
