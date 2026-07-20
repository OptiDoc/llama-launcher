use crate::domain::ModelFormat;

pub fn parse_gguf_header(
    header: &[u8],
) -> (
    ModelFormat,
    Option<String>,
    Option<String>,
    Option<usize>,
    Option<String>,
) {
    let mut pos = 4usize;
    if header.len() < pos + 4 {
        return (ModelFormat::Gguf, None, None, None, None);
    }

    pos += 4;

    if header.len() < pos + 8 { return (ModelFormat::Gguf, None, None, None, None); }
    pos += 8;

    if header.len() < pos + 8 { return (ModelFormat::Gguf, None, None, None, None); }
    let kv_count = u64::from_le_bytes([
        header[pos], header[pos+1], header[pos+2], header[pos+3],
        header[pos+4], header[pos+5], header[pos+6], header[pos+7],
    ]) as usize;
    pos += 8;

    let mut architecture = None::<String>;
    let mut _general_name = None::<String>;
    let mut file_type = None::<u32>;
    let mut context_length = None::<u64>;
    let mut block_count = None::<u64>;
    let mut embedding_length = None::<u64>;
    let mut expert_count = None::<u64>;
    let mut _vocab_size = None::<u64>;

    for _ in 0..kv_count {
        if header.len() < pos + 8 { break; }
        let key_len = u64::from_le_bytes([
            header[pos], header[pos+1], header[pos+2], header[pos+3],
            header[pos+4], header[pos+5], header[pos+6], header[pos+7],
        ]) as usize;
        pos += 8;
        if header.len() < pos + key_len { break; }
        let key = String::from_utf8_lossy(&header[pos..pos + key_len]).to_string();
        pos += key_len;

        if header.len() < pos + 4 { break; }
        let vtype = u32::from_le_bytes([header[pos], header[pos+1], header[pos+2], header[pos+3]]);
        pos += 4;

        match vtype {
            0 | 1 | 7 => { pos += 1; }
            2 | 3 => { pos += 2; }
            4 => {
                if header.len() >= pos + 4 {
                    let val = u32::from_le_bytes([header[pos], header[pos+1], header[pos+2], header[pos+3]]);
                    if key.ends_with(".file_type") || key == "general.file_type" { file_type = Some(val); }
                }
                pos += 4;
            }
            5 | 6 => { pos += 4; }
            8 => {
                if header.len() < pos + 8 { break; }
                let s_len = u64::from_le_bytes([
                    header[pos], header[pos+1], header[pos+2], header[pos+3],
                    header[pos+4], header[pos+5], header[pos+6], header[pos+7],
                ]) as usize;
                pos += 8;
                if header.len() < pos + s_len { break; }
                let val = String::from_utf8_lossy(&header[pos..pos + s_len]).to_string();
                pos += s_len;
                if key == "general.architecture" { architecture = Some(val); }
                else if key == "general.name" { _general_name = Some(val); }
            }
            10 => {
                if header.len() >= pos + 8 {
                    let val = u64::from_le_bytes([
                        header[pos], header[pos+1], header[pos+2], header[pos+3],
                        header[pos+4], header[pos+5], header[pos+6], header[pos+7],
                    ]);
                    if key.ends_with(".context_length") { context_length = Some(val); }
                    else if key.ends_with(".block_count") { block_count = Some(val); }
                    else if key.ends_with(".embedding_length") { embedding_length = Some(val); }
                    else if key.ends_with(".expert_count") { expert_count = Some(val); }
                    else if key.ends_with(".vocab_size") || key.ends_with(".tokenizer.ggml.tokens.size") { _vocab_size = Some(val); }
                }
                pos += 8;
            }
            11 | 12 => { pos += 8; }
            9 => {
                if header.len() < pos + 4 { break; }
                pos += 4;
                if header.len() < pos + 8 { break; }
                break;
            }
            _ => { break; }
        }

        if pos > header.len() - 4 { break; }
    }

    let quant = file_type.map(|ft| quant_name_from_file_type(ft));

    let params = if let (Some(blocks), Some(embed)) = (block_count, embedding_length) {
        if let Some(experts) = expert_count {
            let total = blocks as u64 * embed as u64 * (experts + 1) * 3;
            Some(format_params(total))
        } else {
            let total = blocks as u64 * embed as u64 * embed as u64 * 6 / 10;
            Some(format_params(total))
        }
    } else {
        None
    };

    (ModelFormat::Gguf, architecture, quant, context_length.map(|c| c as usize), params)
}

fn quant_name_from_file_type(ft: u32) -> String {
    match ft {
        0 => "F32".to_string(),
        1 => "F16".to_string(),
        2 => "Q4_0".to_string(),
        3 => "Q4_1".to_string(),
        6 => "Q5_0".to_string(),
        7 => "Q5_1".to_string(),
        8 => "Q8_0".to_string(),
        9 => "Q8_1".to_string(),
        10 => "Q2_K".to_string(),
        11 => "Q3_K_S".to_string(),
        12 => "Q3_K_M".to_string(),
        13 => "Q3_K_L".to_string(),
        14 => "Q4_K_S".to_string(),
        15 => "Q4_K_M".to_string(),
        16 => "Q5_K_S".to_string(),
        17 => "Q5_K_M".to_string(),
        18 => "Q6_K".to_string(),
        19 => "IQ2_XXS".to_string(),
        20 => "IQ2_XS".to_string(),
        21 => "Q2_K_S".to_string(),
        24 => "IQ3_XXS".to_string(),
        25 => "IQ3_S".to_string(),
        26 => "IQ3_M".to_string(),
        27 => "IQ4_XS".to_string(),
        28 => "IQ4_NL".to_string(),
        29 => "IQ2_S".to_string(),
        30 => "IQ2_M".to_string(),
        _ => format!("Unknown({})", ft),
    }
}

fn format_params(count: u64) -> String {
    if count >= 1_000_000_000_000 {
        format!("{:.1}T", count as f64 / 1e12)
    } else if count >= 1_000_000_000 {
        format!("{:.1}B", count as f64 / 1e9)
    } else if count >= 1_000_000 {
        format!("{:.1}M", count as f64 / 1e6)
    } else {
        format!("{}K", count / 1_000)
    }
}
