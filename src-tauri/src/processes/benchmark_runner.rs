use std::path::PathBuf;
use std::sync::Arc;
use std::time::{Duration, SystemTime};

use anyhow::Result;

use crate::domain::{BenchmarkConfig, BenchmarkMetrics, BenchmarkResult, ProcessConfig};

use super::process_manager::ProcessManager;

pub struct BenchmarkRunner {
    manager: Arc<ProcessManager>,
}

impl BenchmarkRunner {
    pub fn new(manager: Arc<ProcessManager>) -> Self {
        Self { manager }
    }

    pub async fn run(&self, config: BenchmarkConfig, model_id: String, model_path: PathBuf) -> Result<BenchmarkResult> {
        let id = uuid::Uuid::new_v4().to_string();

        let process_config = ProcessConfig {
            context_size: config.context_size,
            gpu_layers: config.n_gpu_layers,
            threads: config.n_threads,
            batch_size: config.batch_size,
            ubatch_size: config.batch_size,
            flash_attn: true,
            no_mmap: false,
            no_mlock: false,
            numa: false,
            port: 8080,
            host: "127.0.0.1".to_string(),
            parallel: -1,
            cont_batching: true,
            n_predict: -1,
            timeout: 3600,
            metrics: false,
            api_key: String::new(),
            threads_batch: -1,
            cache_type_k: "f16".to_string(),
            cache_type_v: "f16".to_string(),
            split_mode: "layer".to_string(),
            tensor_split: String::new(),
            main_gpu: 0,
            kv_offload: true,
            fit: true,
            temperature: 0.8,
            top_k: 40,
            top_p: 0.95,
            min_p: 0.05,
            repeat_penalty: 1.0,
            repeat_last_n: 64,
            presence_penalty: 0.0,
            frequency_penalty: 0.0,
            seed: -1,
            lora: String::new(),
            mmproj: String::new(),
            jinja: false,
            reasoning_format: String::new(),
            reasoning_budget: -1,
            chat_template: String::new(),
            rope_scaling: String::new(),
            rope_scale: 0.0,
            rope_freq_base: 0.0,
            rope_freq_scale: 0.0,
            grammar: String::new(),
            json_schema: String::new(),
            log_level: 3,
            arguments: vec!["--embedding".to_string()],
        };

        let process_info = self.manager.start_model(
            model_id.clone(),
            model_path,
            process_config,
        ).await?;

        tokio::time::sleep(Duration::from_secs(3)).await;

        let mut results = Vec::new();

        for _ in 0..config.warmup_runs {
            self.run_single_inference(&process_info, &config.prompt, config.n_predict).await?;
        }

        for _ in 0..config.runs {
            let result = self.run_single_inference(&process_info, &config.prompt, config.n_predict).await?;
            results.push(result);
        }

        self.manager.stop_model(&process_info.id).await?;

        let tokens_per_sec: Vec<f32> = results.iter().map(|r| r.tokens_per_sec).collect();
        let latencies: Vec<f32> = results.iter().map(|r| r.latency_ms).collect();

        let avg_tps = tokens_per_sec.iter().sum::<f32>() / tokens_per_sec.len() as f32;
        let min_tps = tokens_per_sec.iter().fold(f32::INFINITY, |a, &b| a.min(b));
        let max_tps = tokens_per_sec.iter().fold(f32::NEG_INFINITY, |a, &b| a.max(b));

        let mut sorted_latencies = latencies.clone();
        sorted_latencies.sort_by(|a, b| a.partial_cmp(b).unwrap());

        let avg_latency = latencies.iter().sum::<f32>() / latencies.len() as f32;
        let p50 = sorted_latencies[sorted_latencies.len() / 2];
        let p95 = sorted_latencies[(sorted_latencies.len() as f64 * 0.95) as usize];
        let p99 = sorted_latencies[(sorted_latencies.len() as f64 * 0.99) as usize];

        Ok(BenchmarkResult {
            id,
            model_id,
            timestamp: SystemTime::now().duration_since(SystemTime::UNIX_EPOCH).unwrap().as_secs(),
            config,
            results: BenchmarkMetrics {
                avg_tokens_per_sec: avg_tps,
                min_tokens_per_sec: min_tps,
                max_tokens_per_sec: max_tps,
                avg_latency_ms: avg_latency,
                p50_latency_ms: p50,
                p95_latency_ms: p95,
                p99_latency_ms: p99,
                memory_used_mb: 0.0,
                gpu_memory_used_mb: 0.0,
                power_watts: None,
            },
        })
    }

    async fn run_single_inference(&self, process: &crate::domain::ProcessInfo, prompt: &str, n_predict: usize) -> Result<InferenceResult> {
        let client = reqwest::Client::new();
        let url = format!("http://127.0.0.1:{}/completion", process.port);

        let start = std::time::Instant::now();

        let response = client.post(&url)
            .json(&serde_json::json!({
                "prompt": prompt,
                "n_predict": n_predict,
                "temperature": 0.7,
                "top_p": 0.9,
                "stream": false,
            }))
            .send()
            .await?;

        let latency = start.elapsed().as_millis() as f32;

        let json: serde_json::Value = response.json().await?;
        let tokens = json["tokens_predicted"].as_u64().unwrap_or(0) as usize;
        let tps = tokens as f32 / (latency / 1000.0);

        Ok(InferenceResult {
            tokens_per_sec: tps,
            latency_ms: latency,
            tokens_predicted: tokens,
        })
    }
}

#[derive(Debug)]
struct InferenceResult {
    tokens_per_sec: f32,
    latency_ms: f32,
    #[allow(dead_code)]
    tokens_predicted: usize,
}
