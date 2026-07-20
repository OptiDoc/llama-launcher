use std::path::Path;
use std::time::SystemTime;

use crate::domain::{ModelFormat, ModelInfo, ModelMetadata};
use super::model_gguf::parse_gguf_header;
use super::model_format::parse_ggml_header;

pub(crate) async fn detect_model(path: &Path) -> Result<ModelInfo, String> {
    use tokio::io::AsyncReadExt;

    let mut file = tokio::fs::File::open(path)
        .await
        .map_err(|e| format!("Failed to open file: {}", e))?;
    let mut header = vec![0u8; 65536];
    let _ = file.read(&mut header).await;

    let metadata = tokio::fs::metadata(path)
        .await
        .map_err(|e| format!("Failed to get metadata: {}", e))?;

    let size = metadata.len();
    let modified = metadata
        .modified()
        .unwrap_or(SystemTime::UNIX_EPOCH)
        .duration_since(SystemTime::UNIX_EPOCH)
        .unwrap()
        .as_secs();

    let (format, arch, quant, ctx_size, params) = if header.starts_with(b"GGUF") {
        parse_gguf_header(&header)
    } else if header.starts_with(b"GGML") {
        parse_ggml_header(&header)
    } else if header.starts_with(&[0x50, 0x4B, 0x03, 0x04])
        || header.starts_with(&[0x50, 0x4B, 0x05, 0x06])
        || header.starts_with(&[0x50, 0x4B, 0x07, 0x08])
    {
        (ModelFormat::Safetensors, None, None, None, None)
    } else {
        (ModelFormat::PyTorch, None, None, None, None)
    };

    let name = path
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("Unknown")
        .to_string();

    let id = format!(
        "{:x}",
        md5::compute(format!("{}{}", path.display(), size))
    );

    Ok(ModelInfo {
        id,
        name,
        path: path.to_string_lossy().replace('\\', "/"),
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

pub(crate) fn parse_gguf_header_for_external(
    header: &[u8],
) -> (
    Option<String>,
    Option<String>,
    Option<usize>,
    Option<String>,
) {
    let (_, arch, quant, ctx, params) = parse_gguf_header(header);
    (arch, quant, ctx, params)
}

pub(crate) fn parse_ggml_header_for_external(
    _header: &[u8],
) -> (
    Option<String>,
    Option<String>,
    Option<usize>,
    Option<String>,
) {
    let (_, arch, quant, ctx, params) = parse_ggml_header(_header);
    (arch, quant, ctx, params)
}
