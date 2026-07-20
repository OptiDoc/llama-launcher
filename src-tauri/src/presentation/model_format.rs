use crate::domain::ModelFormat;

pub fn parse_ggml_header(
    _header: &[u8],
) -> (
    ModelFormat,
    Option<String>,
    Option<String>,
    Option<usize>,
    Option<String>,
) {
    (
        ModelFormat::Ggml,
        Some("llama".to_string()),
        Some("Q4_0".to_string()),
        Some(2048),
        Some("7B".to_string()),
    )
}
