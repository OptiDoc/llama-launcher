use std::time::SystemTime;

use crate::domain::ProcessInfo;
use super::process_manager::ProcessManager;

impl ProcessManager {
    pub fn get_process(&self, process_id: &str) -> Option<ProcessInfo> {
        let procs = self.processes.lock();
        procs.get(process_id).map(|p| ProcessInfo {
            id: p.id.clone(),
            model_id: p.model_id.clone(),
            pid: if p.pid > 0 { Some(p.pid) } else { None },
            port: p.port,
            status: p.status,
            started_at: p.started_at.duration_since(SystemTime::UNIX_EPOCH).unwrap().as_secs(),
            gpu_memory: p.metrics.gpu_memory_mb,
            cpu_memory: p.metrics.cpu_memory_mb,
            tokens_per_sec: p.metrics.tokens_per_sec,
            context_used: p.metrics.context_used,
        })
    }

    pub fn list_processes(&self) -> Vec<ProcessInfo> {
        let procs = self.processes.lock();
        procs.values().map(|p| ProcessInfo {
            id: p.id.clone(),
            model_id: p.model_id.clone(),
            pid: if p.pid > 0 { Some(p.pid) } else { None },
            port: p.port,
            status: p.status,
            started_at: p.started_at.duration_since(SystemTime::UNIX_EPOCH).unwrap().as_secs(),
            gpu_memory: p.metrics.gpu_memory_mb,
            cpu_memory: p.metrics.cpu_memory_mb,
            tokens_per_sec: p.metrics.tokens_per_sec,
            context_used: p.metrics.context_used,
        }).collect()
    }

    pub fn get_stdout(&self, process_id: &str, lines: usize) -> Vec<String> {
        self.processes.lock()
            .get(process_id)
            .map(|p| {
                let buf = p.stdout_buffer.lock();
                buf.iter().rev().take(lines).cloned().collect()
            })
            .unwrap_or_default()
    }
}
