
use tokio::io::{AsyncBufReadExt, BufReader};

use crate::domain::ProcessStatus;
use crate::{log_debug, log_warn};

use super::process_manager::ProcessManager;

impl ProcessManager {
    pub fn spawn_monitors(&self, process_id: String, _pid: u32) {
        let processes = self.processes.clone();

        if let Some(mut child) = {
            let mut procs = self.processes.lock();
            procs.get_mut(&process_id).and_then(|p| p.child.take())
        } {
            let stdout = child.stdout.take();
            let stderr = child.stderr.take();
            let proc_id = process_id.clone();
            let processes_clone = processes.clone();

            tokio::spawn(async move {
                if let Some(stdout) = stdout {
                    let mut reader = BufReader::new(stdout).lines();
                    while let Ok(Some(line)) = reader.next_line().await {
                        log_debug!(&format!("[{}] stdout: {}", proc_id, line), "processes");

                        if line.contains("tokens per second") || line.contains("t/s") {
                            if let Some(tps) = parse_tokens_per_sec(&line) {
                                if let Some(proc) = processes_clone.lock().get_mut(&proc_id) {
                                    proc.metrics.tokens_per_sec = tps;
                                }
                            }
                        }

                        if let Some(proc) = processes_clone.lock().get_mut(&proc_id) {
                            proc.stdout_buffer.lock().push(line);
                            if proc.stdout_buffer.lock().len() > 1000 {
                                proc.stdout_buffer.lock().drain(0..500);
                            }
                        }
                    }
                }
            });

            let proc_id = process_id.clone();
            let processes_clone = processes.clone();

            tokio::spawn(async move {
                if let Some(stderr) = stderr {
                    let mut reader = BufReader::new(stderr).lines();
                    while let Ok(Some(line)) = reader.next_line().await {
                        log_warn!(&format!("[{}] stderr: {}", proc_id, line), "processes");

                        if let Some(proc) = processes_clone.lock().get_mut(&proc_id) {
                            proc.stderr_buffer.lock().push(line);
                            if proc.stderr_buffer.lock().len() > 1000 {
                                proc.stderr_buffer.lock().drain(0..500);
                            }
                        }
                    }
                }
            });

            let proc_id = process_id;
            tokio::spawn(async move {
                let status = child.wait().await;
                let mut procs = processes.lock();
                if let Some(proc) = procs.get_mut(&proc_id) {
                    proc.status = match status {
                        Ok(s) if s.success() => ProcessStatus::Stopped,
                        Ok(_) => ProcessStatus::Crashed,
                        Err(_) => ProcessStatus::Error,
                    };
                    proc.child = None;
                    proc.pid = 0;
                }
            });
        }
    }
}

pub fn parse_tokens_per_sec(line: &str) -> Option<f32> {
    let line = line.to_lowercase();

    if let Some(idx) = line.find("tokens per second") {
        let before = &line[..idx];
        if let Some(num) = before.split_whitespace().last() {
            return num.parse().ok();
        }
    }

    if let Some(idx) = line.find("t/s") {
        let before = &line[..idx];
        if let Some(num) = before.split_whitespace().last() {
            return num.parse().ok();
        }
    }

    None
}
