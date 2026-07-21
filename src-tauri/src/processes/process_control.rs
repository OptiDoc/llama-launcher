use std::time::Duration;

use crate::domain::{ProcessInfo, ProcessStatus};
use super::process_manager::ProcessManager;

impl ProcessManager {
    pub async fn stop_model(&self, process_id: &str) -> Result<(), anyhow::Error> {
        let (pid, port) = {
            let mut procs = self.processes.lock();
            if let Some(proc) = procs.get_mut(process_id) {
                proc.status = ProcessStatus::Stopping;
                (proc.pid, proc.port)
            } else {
                return Ok(());
            }
        };

        if pid > 0 {
            #[cfg(target_os = "windows")]
            {
                std::process::Command::new("taskkill")
                    .args(["/F", "/PID", &pid.to_string()])
                    .status()
                    .ok();
            }
            #[cfg(not(target_os = "windows"))]
            {
                std::process::Command::new("kill")
                    .args(["-TERM", &pid.to_string()])
                    .status()
                    .ok();

                tokio::time::sleep(Duration::from_secs(2)).await;

                std::process::Command::new("kill")
                    .args(["-KILL", &pid.to_string()])
                    .status()
                    .ok();
            }
        }

        {
            let mut procs = self.processes.lock();
            if let Some(proc) = procs.get_mut(process_id) {
                proc.status = ProcessStatus::Stopped;
                proc.pid = 0;
            }
        }
        self.port_allocator.lock().release(port);

        Ok(())
    }

    pub async fn restart_model(&self, process_id: &str) -> Result<ProcessInfo, anyhow::Error> {
        let (model_id, model_path, config) = {
            let procs = self.processes.lock();
            let proc = procs.get(process_id)
                .ok_or_else(|| anyhow::anyhow!("Process not found"))?;
            (proc.model_id.clone(), proc.model_path.clone(), proc.config.clone())
        };

        self.stop_model(process_id).await?;
        tokio::time::sleep(Duration::from_millis(500)).await;

        self.start_model(model_id, std::path::PathBuf::from(model_path), config).await
    }

    pub fn cleanup(&self) {
        let mut procs = self.processes.lock();
        let mut dead = Vec::new();

        for (id, proc) in procs.iter() {
            if matches!(proc.status, ProcessStatus::Stopped | ProcessStatus::Crashed | ProcessStatus::Error) {
                dead.push(id.clone());
            }
        }

        for id in dead {
            if let Some(proc) = procs.remove(&id) {
                self.port_allocator.lock().release(proc.port);
            }
        }
    }
}
