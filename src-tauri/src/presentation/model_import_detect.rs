pub async fn detect_model_info(path: &std::path::Path) -> Result<(String, Option<String>, Option<String>), String> {
    use tokio::fs::File;
    use tokio::io::AsyncReadExt;

    let mut file = File::open(path).await.map_err(|e| e.to_string())?;
    let mut header = vec![0u8; 65536];
    let _ = file.read(&mut header).await;

    if header.starts_with(b"GGUF") {
        let (_arch, quant, _ctx, params) = crate::presentation::model_detect::parse_gguf_header_for_external(&header);
        Ok(("GGUF".to_string(), params, quant))
    } else if header.starts_with(b"GGML") {
        let (_arch, quant, _ctx, params) = crate::presentation::model_detect::parse_ggml_header_for_external(&header);
        Ok(("GGML".to_string(), params, quant))
    } else if header.starts_with(&[0x50, 0x4B, 0x03, 0x04])
        || header.starts_with(&[0x50, 0x4B, 0x05, 0x06])
        || header.starts_with(&[0x50, 0x4B, 0x07, 0x08])
    {
        Ok(("SafeTensors".to_string(), None, None))
    } else if header.starts_with(b"\x80\x02") || header.starts_with(b"\x80\x01") {
        Ok(("PyTorch".to_string(), None, None))
    } else if header.starts_with("ONNX".as_bytes()) {
        Ok(("ONNX".to_string(), None, None))
    } else {
        let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("Unknown");
        Ok((ext.to_uppercase(), None, None))
    }
}
