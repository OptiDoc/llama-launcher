use std::fs;
use std::io::Write;
use std::time::{SystemTime, UNIX_EPOCH};

use super::logger_types::{LogLevel, LogEntry};
use super::logger_state::LOGGER_STATE;

pub fn generate_log_id() -> String {
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos();
    format!("log_{}_{}", now, rand::random::<u64>())
}

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
        LogLevel::Debug => "\x1b[36m",
        LogLevel::Info => "\x1b[32m",
        LogLevel::Success => "\x1b[32m",
        LogLevel::Warn => "\x1b[33m",
        LogLevel::Error => "\x1b[31m",
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

pub fn format_full(entry: &LogEntry) -> String {
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

pub fn log_entry(entry: LogEntry) {
    let mut state = match LOGGER_STATE.lock() {
        Ok(s) => s,
        Err(e) => {
            eprintln!("[LOGGER] Mutex poisoned in log_entry: {}", e);
            if let Ok(mut s) = LOGGER_STATE.lock() {
                s.logs.push_back(entry.clone());
                if s.logs.len() > 10000 { s.logs.pop_front(); }
                println!("{}", format_console(&entry));
            }
            return;
        }
    };
    
    let should_log = match (&entry.level, &state.min_level) {
        (LogLevel::Debug, _) => state.debug_mode,
        (LogLevel::Info | LogLevel::Success, _) => true,
        (LogLevel::Warn | LogLevel::Error, _) => true,
    };
    
    let full_log_mode = state.full_log_mode;
    
    if full_log_mode {
        let log_dir = if cfg!(windows) {
            std::env::var("USERPROFILE").map(|p| std::path::PathBuf::from(p).join(".llama-launcher").join("logs"))
        } else {
            std::env::var("HOME").map(|p| std::path::PathBuf::from(p).join(".llama-launcher").join("logs"))
        };
        
        if let Ok(dir) = log_dir {
            if let Err(e) = fs::create_dir_all(&dir) {
                eprintln!("[LOGGER] Failed to create log dir {}: {}", dir.display(), e);
            }
            let log_file = dir.join(match entry.level {
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
                    if let Err(e) = file.write_all(format!("{}\n", format_full(&entry)).as_bytes()) {
                        eprintln!("[LOGGER] Failed to write to {}: {}", log_file.display(), e);
                    }
                }
                Err(e) => {
                    eprintln!("[LOGGER] Failed to open {}: {}", log_file.display(), e);
                }
            }
        } else if let Err(e) = log_dir {
            eprintln!("[LOGGER] Failed to get log directory: {}", e);
        }
    }
    
    if !should_log && entry.level != LogLevel::Error && entry.level != LogLevel::Warn {
        return;
    }
    
    state.logs.push_back(entry.clone());
    if state.logs.len() > 10000 {
        state.logs.pop_front();
    }
    
    println!("{}", format_console(&entry));
}
