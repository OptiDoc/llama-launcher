use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelInfo {
    pub id: String,
    pub name: String,
    pub path: String,
    pub size: u64,
    pub format: ModelFormat,
    pub architecture: Option<String>,
    pub quantization: Option<String>,
    pub context_size: Option<usize>,
    pub parameter_count: Option<String>,
    pub modified: u64,
    pub metadata: ModelMetadata,
    pub checksum: Option<String>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum ModelFormat {
    Gguf,
    Ggml,
    PyTorch,
    Safetensors,
    Onnx,
    TensorRT,
    Other,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct ModelMetadata {
    pub description: Option<String>,
    pub author: Option<String>,
    pub license: Option<String>,
    pub tags: Vec<String>,
    pub model_card: Option<String>,
    pub downloads: Option<u64>,
    pub likes: Option<u64>,
}
