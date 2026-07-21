use std::sync::{Arc, Mutex};

use super::logger_types::LoggerState;

pub static LOGGER_STATE: once_cell::sync::Lazy<Arc<Mutex<LoggerState>>> =
    once_cell::sync::Lazy::new(|| Arc::new(Mutex::new(LoggerState::new())));

pub fn init_logger() {
    super::logger_levels::info("Logger initialized", "startup", None);
}

pub fn get_state() -> Arc<Mutex<LoggerState>> {
    LOGGER_STATE.clone()
}
