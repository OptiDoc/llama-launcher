use std::fs::{self, OpenOptions};
use std::io::{BufWriter, Write};
use std::time::{SystemTime, UNIX_EPOCH};

use super::correlation::get_correlation_id;
use super::logger_types::{LogLevel, LogEntry, LoggerState};

const LOG_DIR_REL: &str = ".llama-launcher/logs";
const LOG_FILE_NAME: &str = "app.log";
const MAX_FILE_SIZE: u64 = 10 * 1024 * 1024;
const MAX_ROTATED_FILES: usize = 5;
const CHECK_ROTATION_EVERY: u64 = 100;

fn log_dir() -> Option<std::path::PathBuf> {
    if let Ok(profile) = std::env::var("USERPROFILE") {
        Some(std::path::PathBuf::from(profile).join(LOG_DIR_REL))
    } else if let Ok(home) = std::env::var("HOME") {
        Some(std::path::PathBuf::from(home).join(LOG_DIR_REL))
    } else {
        None
    }
}

fn format_console(entry: &LogEntry) -> String {
    let secs = entry.timestamp / 1000;
    let millis = entry.timestamp % 1000;
    let time = format!(
        "{:02}:{:02}:{:02}.{:03}",
        (secs / 3600) % 24,
        (secs / 60) % 60,
        secs % 60,
        millis
    );

    let level_color = match entry.level {
        LogLevel::Debug => "\x1b[36m",
        LogLevel::Info => "\x1b[32m",
        LogLevel::Warn => "\x1b[33m",
        LogLevel::Error => "\x1b[31m",
    };
    let reset = "\x1b[0m";

    let cat = if entry.category.is_empty() {
        String::new()
    } else {
        format!("({})", entry.category)
    };

    format!("{}[{}]{} {}{} {}", level_color, entry.level, reset, time, cat, entry.message)
}

fn format_json_line(entry: &LogEntry) -> String {
    serde_json::to_string(entry).unwrap_or_else(|_| format!("{{\"error\":\"serialization_failed\",\"message\":\"{}\"}}", entry.message))
}

fn rotate_log_file() {
    let Some(dir) = log_dir() else {
        return;
    };
    let current = dir.join(LOG_FILE_NAME);

    for i in (1..MAX_ROTATED_FILES).rev() {
        let src = dir.join(format!("app.log.{}", i));
        let dst = dir.join(format!("app.log.{}", i + 1));
        if src.exists() {
            let _ = fs::rename(&src, &dst);
        }
    }
    let _ = fs::rename(&current, dir.join("app.log.1"));
    let _ = fs::create_dir_all(&dir);
}

fn cleanup_old_files() {
    let Some(dir) = log_dir() else {
        return;
    };
    if let Ok(entries) = fs::read_dir(&dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if let Ok(metadata) = entry.metadata() {
                if let Ok(modified) = metadata.modified() {
                    if let Ok(age) = SystemTime::now().duration_since(modified) {
                        if age > std::time::Duration::from_secs(5 * 24 * 3600) {
                            let _ = fs::remove_file(path);
                        }
                    }
                }
            }
        }
    }
}

pub fn write_log_entry(entry: &LogEntry, state: &LoggerState) {
    if state.full_log_mode {
        let Some(dir) = log_dir() else {
            return;
        };
        let _ = fs::create_dir_all(&dir);

        let should_rotate = entry.timestamp.is_multiple_of(CHECK_ROTATION_EVERY);
        if should_rotate {
            if let Ok(metadata) = fs::metadata(dir.join(LOG_FILE_NAME)) {
                if metadata.len() >= MAX_FILE_SIZE {
                    rotate_log_file();
                    cleanup_old_files();
                }
            }
        }

        if let Ok(file) = OpenOptions::new()
            .create(true)
            .append(true)
            .open(dir.join(LOG_FILE_NAME))
        {
            let mut writer = BufWriter::new(file);
            let line = format_json_line(entry);
            let _ = writer.write_all(line.as_bytes());
            let _ = writer.write_all(b"\n");
        }
    }
}

pub fn dispatch_log_entry(entry: LogEntry, state: &LoggerState) {
    let should_log = match (&entry.level, &state.min_level) {
        (LogLevel::Debug, _) => state.debug_mode,
        _ => entry.level.as_numeric() >= state.min_level.as_numeric(),
    };

    write_log_entry(&entry, state);

    if !should_log && entry.level != LogLevel::Error && entry.level != LogLevel::Warn {
        return;
    }

    println!("{}", format_console(&entry));
}

pub fn push_to_queue(state: &mut LoggerState, entry: LogEntry) {
    state.logs.push_back(entry);
    if state.logs.len() > 10_000 {
        state.logs.pop_front();
    }
}

pub fn current_timestamp_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

pub fn current_correlation_id() -> Option<String> {
    get_correlation_id()
}
