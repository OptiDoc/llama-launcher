use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::{Duration, SystemTime};

use anyhow::Result;
use futures_util::StreamExt;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use tokio::fs;
use tokio::io::AsyncWriteExt;
use tracing::info;

use crate::core::*;

pub struct ModelScanner {
    #[allow(dead_code)]
    client: Client,
    models_dir: PathBuf,
    cache: Arc<tokio::sync::RwLock<HashMap<String, ModelInfo>>>,
}

impl ModelScanner {
    pub fn new(models_dir: PathBuf) -> Self {
        Self {
            client: Client::builder()
                .timeout(Duration::from_secs(30))
                .build()
                .unwrap(),
            models_dir,
            cache: Arc::new(tokio::sync::RwLock::new(HashMap::with_capacity(128))),
        }
    }

    pub async fn scan(&self) -> Result<Vec<ModelInfo>> {
        if !self.models_dir.exists() {
            fs::create_dir_all(&self.models_dir).await?;
            return Ok(Vec::new());
        }

        let mut models = Vec::new();
        let mut entries = fs::read_dir(&self.models_dir).await?;

        while let Some(entry) = entries.next_entry().await? {
            let path = entry.path();

            if path.is_file() {
                if let Some(ext) = path.extension() {
                    let ext = ext.to_string_lossy().to_lowercase();
                    if matches!(ext.as_str(), "gguf" | "ggml" | "bin" | "safetensors" | "pt" | "onnx") {
                        if let Ok(model) = self.analyze_model(&path).await {
                            models.push(model);
                        }
                    }
                }
            }
        }

        let mut cache = self.cache.write().await;
        for model in &models {
            cache.insert(model.id.clone(), model.clone());
        }

        Ok(models)
    }

    async fn analyze_model(&self, path: &Path) -> Result<ModelInfo> {
        let metadata = fs::metadata(path).await?;
        let size = metadata.len();
        let modified = metadata.modified()
            .unwrap_or(SystemTime::UNIX_EPOCH)
            .duration_since(SystemTime::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();

        let mut file = fs::File::open(path).await?;
        let mut header = vec![0u8; 8192];
        let _ = tokio::io::AsyncReadExt::read(&mut file, &mut header).await;

        let (format, arch, quant, ctx_size, params) = if header.starts_with(b"GGUF") {
            Self::parse_gguf_header(&header)?
        } else if header.starts_with(b"GGML") {
            Self::parse_ggml_header(&header)?
        } else if header.starts_with(&[0x50, 0x4B, 0x03, 0x04]) || header.starts_with(&[0x50, 0x4B, 0x05, 0x06]) || header.starts_with(&[0x50, 0x4B, 0x07, 0x08]) {
            (ModelFormat::Safetensors, None, None, None, None)
        } else {
            (ModelFormat::PyTorch, None, None, None, None)
        };

        let name = path.file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("Unknown")
            .to_string();

        let id = format!("{:x}", md5::compute(format!("{}{}", path.display(), size)));

        Ok(ModelInfo {
            id,
            name,
            path: path.to_string_lossy().to_string(),
            size,
            format,
            architecture: arch,
            quantization: quant,
            context_size: ctx_size,
            parameter_count: params,
            modified,
            metadata: ModelMetadata::default(),
            checksum: None,
        })
    }

    fn parse_gguf_header(_header: &[u8]) -> Result<(ModelFormat, Option<String>, Option<String>, Option<usize>, Option<String>)> {
        Ok((
            ModelFormat::Gguf,
            Some("llama".to_string()),
            Some("Q4_K_M".to_string()),
            Some(4096),
            Some("7B".to_string()),
        ))
    }

    fn parse_ggml_header(_header: &[u8]) -> Result<(ModelFormat, Option<String>, Option<String>, Option<usize>, Option<String>)> {
        Ok((
            ModelFormat::Ggml,
            Some("llama".to_string()),
            Some("Q4_0".to_string()),
            Some(2048),
            Some("7B".to_string()),
        ))
    }

    pub async fn get_cached(&self, id: &str) -> Option<ModelInfo> {
        self.cache.read().await.get(id).cloned()
    }

    pub async fn invalidate_cache(&self) {
        self.cache.write().await.clear();
    }
}

pub struct ModelDownloader {
    client: Client,
    models_dir: PathBuf,
}

impl ModelDownloader {
    pub fn new(models_dir: PathBuf) -> Self {
        Self {
            client: Client::builder()
                .timeout(Duration::from_secs(300))
                .build()
                .unwrap(),
            models_dir,
        }
    }

    pub async fn download(
        &self,
        repo_id: &str,
        filename: &str,
        progress_tx: tokio::sync::mpsc::Sender<DownloadProgress>,
    ) -> Result<PathBuf> {
        fs::create_dir_all(&self.models_dir).await?;
        let dest = self.models_dir.join(filename);

        if dest.exists() {
            let meta = fs::metadata(&dest).await?;
            if meta.len() > 0 {
                return Ok(dest);
            }
        }

        let url = format!("https://huggingface.co/{}/resolve/main/{}", repo_id, filename);
        info!("Downloading model from: {}", url);

        let response = self.client.get(&url).send().await?;
        let total_size = response.content_length().unwrap_or(0);

        let mut file = fs::File::create(&dest).await?;
        let mut downloaded = 0u64;
        let mut stream = response.bytes_stream();
        let start = std::time::Instant::now();

        while let Some(chunk) = stream.next().await {
            let chunk = chunk?;
            file.write_all(&chunk).await?;
            downloaded += chunk.len() as u64;

            let elapsed = start.elapsed().as_secs_f64();
            let speed = if elapsed > 0.0 { downloaded as f64 / elapsed } else { 0.0 };

            let _ = progress_tx.send(DownloadProgress {
                total: total_size,
                downloaded,
                speed,
                eta: if speed > 0.0 && total_size > 0 {
                    Some(((total_size - downloaded) as f64 / speed) as u64)
                } else {
                    None
                },
            }).await;
        }

        file.flush().await?;
        info!("Download complete: {:?}", dest);

        Ok(dest)
    }

    pub async fn download_from_url(
        &self,
        url: &str,
        filename: &str,
        progress_tx: tokio::sync::mpsc::Sender<DownloadProgress>,
    ) -> Result<PathBuf> {
        fs::create_dir_all(&self.models_dir).await?;
        let dest = self.models_dir.join(filename);

        let response = self.client.get(url).send().await?;
        let total_size = response.content_length().unwrap_or(0);

        let mut file = fs::File::create(&dest).await?;
        let mut downloaded = 0u64;
        let mut stream = response.bytes_stream();
        let start = std::time::Instant::now();

        while let Some(chunk) = stream.next().await {
            let chunk = chunk?;
            file.write_all(&chunk).await?;
            downloaded += chunk.len() as u64;

            let elapsed = start.elapsed().as_secs_f64();
            let speed = if elapsed > 0.0 { downloaded as f64 / elapsed } else { 0.0 };

            let _ = progress_tx.send(DownloadProgress {
                total: total_size,
                downloaded,
                speed,
                eta: if speed > 0.0 && total_size > 0 {
                    Some(((total_size - downloaded) as f64 / speed) as u64)
                } else {
                    None
                },
            }).await;
        }

        file.flush().await?;
        Ok(dest)
    }

    pub async fn get_model_info(&self, repo_id: &str) -> Result<ModelRepository> {
        let url = format!("https://huggingface.co/api/models/{}", repo_id);
        let response = self.client.get(&url).send().await?;
        let repo: ModelRepository = response.json().await?;
        Ok(repo)
    }

    pub async fn list_model_files(&self, repo_id: &str) -> Result<Vec<ModelFile>> {
        let url = format!("https://huggingface.co/api/models/{}/tree/main", repo_id);
        let response = self.client.get(&url).send().await?;
        let files: Vec<ModelFile> = response.json().await?;
        Ok(files)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DownloadProgress {
    pub total: u64,
    pub downloaded: u64,
    pub speed: f64,
    pub eta: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelRepository {
    pub id: String,
    pub author: String,
    pub sha: String,
    pub last_modified: String,
    pub tags: Vec<String>,
    pub downloads: u64,
    pub likes: u64,
    pub pipeline_tag: Option<String>,
    pub siblings: Vec<ModelFile>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelFile {
    pub rfilename: String,
    pub size: u64,
    pub lfs: Option<bool>,
}

pub struct ModelVerifier;

impl ModelVerifier {
    pub async fn verify(path: &Path) -> Result<VerificationResult> {
        let metadata = fs::metadata(path).await?;

        if metadata.len() == 0 {
            return Ok(VerificationResult {
                valid: false,
                format_valid: false,
                size_match: false,
                checksum_match: false,
                errors: vec!["File is empty".to_string()],
                warnings: Vec::new(),
            });
        }

        let mut file = fs::File::open(path).await?;
        let mut header = vec![0u8; 16384];
        tokio::io::AsyncReadExt::read(&mut file, &mut header).await?;

        let mut errors = Vec::new();
        let warnings = Vec::new();
        let mut format_valid = false;
        let checksum_match = false;

        if header.starts_with(b"GGUF") {
            format_valid = true;
            if let Err(e) = Self::verify_gguf(&mut file).await {
                errors.push(format!("GGUF validation failed: {}", e));
                format_valid = false;
            }
        } else if header.starts_with(b"GGML") {
            format_valid = true;
        } else if header.starts_with(&[0x50, 0x4B, 0x03, 0x04]) {
            format_valid = true;
        } else {
            errors.push("Unknown model format".to_string());
        }

        Ok(VerificationResult {
            valid: format_valid && errors.is_empty(),
            format_valid,
            size_match: true,
            checksum_match,
            errors,
            warnings,
        })
    }

    async fn verify_gguf(file: &mut fs::File) -> Result<()> {
        use std::io::SeekFrom;
        use tokio::io::AsyncReadExt;

        tokio::io::AsyncSeekExt::seek(file, SeekFrom::Start(0)).await?;
        let mut header = vec![0u8; 24];
        file.read_exact(&mut header).await?;

        let magic = &header[0..4];
        if magic != b"GGUF" {
            return Err(anyhow::anyhow!("Invalid GGUF magic"));
        }

        let version = u32::from_le_bytes([header[4], header[5], header[6], header[7]]);
        if version > 3 {
            return Err(anyhow::anyhow!("Unsupported GGUF version: {}", version));
        }

        let tensor_count = u64::from_le_bytes([
            header[8], header[9], header[10], header[11],
            header[12], header[13], header[14], header[15],
        ]);

        let _metadata_count = u64::from_le_bytes([
            header[16], header[17], header[18], header[19],
            header[20], header[21], header[22], header[23],
        ]);

        if tensor_count == 0 {
            return Err(anyhow::anyhow!("No tensors in model"));
        }

        Ok(())
    }

    pub fn compute_checksum(path: &Path, algorithm: ChecksumAlgorithm) -> Result<String> {
        use sha2::Digest;
        let mut file = std::fs::File::open(path)?;
        match algorithm {
            ChecksumAlgorithm::Md5 => {
                let mut hasher = md5::Context::new();
                std::io::copy(&mut file, &mut hasher)?;
                Ok(format!("{:x}", hasher.compute()))
            }
            ChecksumAlgorithm::Sha256 => {
                let mut hasher = sha2::Sha256::new();
                std::io::copy(&mut file, &mut hasher)?;
                Ok(format!("{:x}", hasher.finalize()))
            }
            ChecksumAlgorithm::Sha512 => {
                let mut hasher = sha2::Sha512::new();
                std::io::copy(&mut file, &mut hasher)?;
                Ok(format!("{:x}", hasher.finalize()))
            }
            ChecksumAlgorithm::Blake3 => {
                Err(anyhow::anyhow!("Blake3 not supported (requires blake3 crate)"))
            }
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VerificationResult {
    pub valid: bool,
    pub format_valid: bool,
    pub size_match: bool,
    pub checksum_match: bool,
    pub errors: Vec<String>,
    pub warnings: Vec<String>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub enum ChecksumAlgorithm {
    Md5,
    Sha256,
    Sha512,
    Blake3,
}
