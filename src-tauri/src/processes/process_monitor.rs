
use tokio::io::{AsyncBufReadExt, BufReader};

use crate::domain::ProcessStatus;
use crate::{log_debug, log_warn};

use super::process_manager::ProcessManager;

impl ProcessManager {
    pub fn spawn_monitors(&self, process_id: String, _pid: u32, mut child: tokio::process::Child) {
        let processes = self.processes.clone();

        // Extract stdout and stderr before moving child to the monitor task
        let stdout = child.stdout.take();
        let stderr = child.stderr.take();

        let proc_id = process_id.clone();
        let processes_clone = processes.clone();

        // Single task that owns the child and handles stdout, stderr, and wait
        tokio::spawn(async move {
            let mut stdout_reader = stdout.map(BufReader::new).map(|r| r.lines());
            let mut stderr_reader = stderr.map(BufReader::new).map(|r| r.lines());

            // Poll stdout and stderr concurrently
            let proc_id_stdout = proc_id.clone();
            let processes_stdout = processes_clone.clone();
            let stdout_handle = if let Some(mut reader) = stdout_reader {
                Some(tokio::spawn(async move {
                    while let Ok(Some(line)) = reader.next_line().await {
                        log_debug!(&format!("[{}] stdout: {}", proc_id_stdout, line), "processes");

                        if line.contains("tokens per second") || line.contains("t/s") {
                            if let Some(tps) = parse_tokens_per_sec(&line) {
                                if let Some(proc) = processes_stdout.lock().get_mut(&proc_id_stdout) {
                                    proc.metrics.tokens_per_sec = tps;
                                }
                            }
                        }

                        if let Some(proc) = processes_stdout.lock().get_mut(&proc_id_stdout) {
                            proc.stdout_buffer.lock().push(line);
                            if proc.stdout_buffer.lock().len() > 1000 {
                                proc.stdout_buffer.lock().drain(0..500);
                            }
                        }
                    }
                }))
            } else {
                None
            };

            let proc_id_stderr = proc_id.clone();
            let processes_stderr = processes_clone.clone();
            let stderr_handle = if let Some(mut reader) = stderr_reader {
                Some(tokio::spawn(async move {
                    while let Ok(Some(line)) = reader.next_line().await {
                        log_warn!(&format!("[{}] stderr: {}", proc_id_stderr, line), "processes");

                        if let Some(proc) = processes_stderr.lock().get_mut(&proc_id_stderr) {
                            proc.stderr_buffer.lock().push(line);
                            if proc.stderr_buffer.lock().len() > 1000 {
                                proc.stderr_buffer.lock().drain(0..500);
                            }
                        }
                    }
                }))
            } else {
                None
            };

            // Wait for stdout and stderr readers to finish
            if let Some(h) = stdout_handle {
                let _ = h.await;
            }
            if let Some(h) = stderr_handle {
                let _ = h.await;
            }

            // Now wait for the child process to exit
            let status = child.wait().await;
            let mut procs = processes_clone.lock();
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
