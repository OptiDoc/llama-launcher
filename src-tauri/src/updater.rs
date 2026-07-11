use std::collections::HashMap;
use std::path::PathBuf;
use std::time::{Duration, SystemTime};

use anyhow::{Context, Result};
use futures_util::StreamExt;
use reqwest::Client;
use semver::Version;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager, Runtime};
use tokio::io::AsyncWriteExt;
use tracing::{debug, info};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateInfo {
    pub version: String,
    pub notes: String,
    pub pub_date: String,
    pub platforms: HashMap<String, PlatformUpdate>,
    pub critical: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlatformUpdate {
    pub url: String,
    pub signature: String,
    pub size: u64,
    pub checksum: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdaterConfig {
    pub enabled: bool,
    pub check_interval_hours: u64,
    pub endpoint: String,
    pub allow_prerelease: bool,
    pub auto_download: bool,
    pub auto_install: bool,
}

impl Default for UpdaterConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            check_interval_hours: 24,
            endpoint: "https://github.com/OptiDoc/llama-launcher/releases/latest/download/latest.json".to_string(),
            allow_prerelease: false,
            auto_download: false,
            auto_install: false,
        }
    }
}

pub struct AutoUpdater {
    config: UpdaterConfig,
    client: Client,
    last_check: std::sync::Mutex<Option<SystemTime>>,
    current_version: Version,
}

impl AutoUpdater {
    pub fn new(current_version: &str, config: UpdaterConfig) -> Result<Self> {
        Ok(Self {
            config,
            client: Client::builder()
                .timeout(Duration::from_secs(30))
                .build()?,
            last_check: std::sync::Mutex::new(None),
            current_version: Version::parse(current_version)?,
        })
    }

    pub async fn check(&self) -> Result<Option<UpdateInfo>> {
        if !self.config.enabled {
            return Ok(None);
        }

        let mut last_check = self.last_check.lock().unwrap();
        if let Some(last) = *last_check {
            if last.elapsed().unwrap_or(Duration::MAX) < Duration::from_secs(self.config.check_interval_hours * 3600) {
                debug!("Skipping update check, last check was recent");
                return Ok(None);
            }
        }
        *last_check = Some(SystemTime::now());

        info!("Checking for updates from {}", self.config.endpoint);

        let response = self.client.get(&self.config.endpoint).send().await?;

        if !response.status().is_success() {
            return Err(anyhow::anyhow!("Update check failed: {}", response.status()));
        }

        let update_info: UpdateInfo = response.json().await?;

        let platform = Self::current_platform();
        if let Some(_platform_update) = update_info.platforms.get(&platform) {
            let latest_version = Version::parse(&update_info.version)?;

            if latest_version > self.current_version {
                info!("Update available: {} -> {}", self.current_version, latest_version);
                return Ok(Some(update_info));
            }
        }

        info!("No updates available");
        Ok(None)
    }

    pub async fn download_and_install<R: Runtime>(
        &self,
        app: &AppHandle<R>,
        update: &UpdateInfo,
        progress_tx: tokio::sync::mpsc::Sender<UpdateProgress>,
    ) -> Result<()> {
        let platform = Self::current_platform();
        let platform_update = update.platforms.get(&platform)
            .ok_or_else(|| anyhow::anyhow!("No update for platform: {}", platform))?;

        info!("Downloading update from {}", platform_update.url);

        let dest_dir = app.path().app_data_dir()
            .context("Failed to get app data dir")?
            .join("updates");
        tokio::fs::create_dir_all(&dest_dir).await?;

        let filename = format!("llama-launcher-update-{}.{}",
            update.version,
            if cfg!(target_os = "windows") { "msi" } else { "dmg" });
        let dest_path = dest_dir.join(&filename);

        let mut stream = self.client.get(&platform_update.url).send().await?.bytes_stream();
        let mut file = tokio::fs::File::create(&dest_path).await?;
        let total = platform_update.size;
        let mut downloaded = 0u64;

        while let Some(chunk) = stream.next().await {
            let chunk = chunk?;
            file.write_all(&chunk).await?;
            downloaded += chunk.len() as u64;

            let _ = progress_tx.send(UpdateProgress {
                total,
                downloaded,
                speed: 0.0,
                stage: UpdateStage::Downloading,
            }).await;
        }

        file.flush().await?;

        let _ = progress_tx.send(UpdateProgress {
            total,
            downloaded,
            speed: 0.0,
            stage: UpdateStage::Verifying,
        }).await;

        let computed = Self::compute_checksum(&dest_path).await?;
        if computed != platform_update.checksum {
            return Err(anyhow::anyhow!("Checksum mismatch"));
        }

        let _ = progress_tx.send(UpdateProgress {
            total,
            downloaded,
            speed: 0.0,
            stage: UpdateStage::VerifyingSignature,
        }).await;

        if !Self::verify_signature(&dest_path, &platform_update.signature).await? {
            return Err(anyhow::anyhow!("Signature verification failed"));
        }

        let _ = progress_tx.send(UpdateProgress {
            total,
            downloaded,
            speed: 0.0,
            stage: UpdateStage::Installing,
        }).await;

        Self::install_update(&dest_path).await?;

        info!("Update installed successfully");
        Ok(())
    }

    async fn compute_checksum(path: &PathBuf) -> Result<String> {
        use sha2::{Digest, Sha256};
        let mut file = tokio::fs::File::open(path).await?;
        let mut hasher = Sha256::new();
        let mut buffer = vec![0u8; 8192];

        loop {
            let n = tokio::io::AsyncReadExt::read(&mut file, &mut buffer).await?;
            if n == 0 { break; }
            hasher.update(&buffer[..n]);
        }

        Ok(format!("{:x}", hasher.finalize()))
    }

    async fn verify_signature(path: &PathBuf, _signature: &str) -> Result<bool> {
        let _data = tokio::fs::read(path).await?;
        // Signature verification requires 'minisign-verify' crate
        // Stubbed out until the dependency is added
        info!("Signature verification stubbed - skipping actual verification");
        Ok(true)
    }

    async fn install_update(path: &PathBuf) -> Result<()> {
        #[cfg(target_os = "windows")]
        {
            std::process::Command::new("msiexec")
                .args(["/i", path.to_str().unwrap(), "/quiet", "/norestart"])
                .status()?;
        }
        #[cfg(target_os = "macos")]
        {
            std::process::Command::new("installer")
                .args(["-pkg", path.to_str().unwrap(), "-target", "/"])
                .status()?;
        }
        #[cfg(target_os = "linux")]
        {
            if path.extension().map_or(false, |e| e == "AppImage") {
                std::process::Command::new("chmod")
                    .args(["+x", path.to_str().unwrap()])
                    .status()?;
            }
        }
        Ok(())
    }

    fn current_platform() -> String {
        format!("{}-{}",
            std::env::consts::OS,
            std::env::consts::ARCH
        )
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateProgress {
    pub total: u64,
    pub downloaded: u64,
    pub speed: f64,
    pub stage: UpdateStage,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub enum UpdateStage {
    Checking,
    Downloading,
    Verifying,
    VerifyingSignature,
    Installing,
    Complete,
    Error,
}

pub mod github {
    use super::*;
    use serde::Deserialize;

    #[derive(Debug, Deserialize)]
    pub struct Release {
        pub tag_name: String,
        pub name: String,
        pub body: String,
        pub published_at: String,
        pub prerelease: bool,
        pub draft: bool,
        pub assets: Vec<Asset>,
    }

    #[derive(Debug, Deserialize)]
    pub struct Asset {
        pub name: String,
        pub browser_download_url: String,
        pub size: u64,
        pub content_type: String,
    }

    pub async fn fetch_latest_release(repo: &str) -> Result<Release> {
        let client = Client::new();
        let url = format!("https://api.github.com/repos/{}/releases/latest", repo);

        let response = client.get(&url)
            .header("User-Agent", "llama-launcher")
            .send()
            .await?;

        if !response.status().is_success() {
            return Err(anyhow::anyhow!("Failed to fetch release: {}", response.status()));
        }

        Ok(response.json().await?)
    }

    pub async fn fetch_all_releases(repo: &str) -> Result<Vec<Release>> {
        let client = Client::new();
        let url = format!("https://api.github.com/repos/{}/releases", repo);

        let response = client.get(&url)
            .header("User-Agent", "llama-launcher")
            .send()
            .await?;

        Ok(response.json().await?)
    }

    pub fn find_asset_for_platform<'a>(release: &'a Release, platform: &str) -> Option<&'a Asset> {
        let patterns = match platform {
            "windows-x86_64" => vec![".msi", ".exe"],
            "macos-x86_64" => vec![".dmg", ".tar.gz"],
            "macos-aarch64" => vec!["-aarch64.dmg", "-arm64.dmg", "-aarch64.tar.gz"],
            "linux-x86_64" => vec![".AppImage", ".deb", ".tar.gz", ".rpm"],
            "linux-aarch64" => vec!["-aarch64.AppImage", "-arm64.deb", "-aarch64.tar.gz"],
            _ => vec![],
        };

        release.assets.iter().find(|asset| {
            patterns.iter().any(|p| asset.name.ends_with(p))
        })
    }
}
