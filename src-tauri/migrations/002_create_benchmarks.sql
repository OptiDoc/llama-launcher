-- Migration 002: Create benchmarks table
CREATE TABLE IF NOT EXISTS benchmarks (
    id TEXT PRIMARY KEY,
    model_id TEXT NOT NULL,
    config TEXT NOT NULL,
    avg_tokens_per_sec REAL NOT NULL,
    min_tokens_per_sec REAL NOT NULL,
    max_tokens_per_sec REAL NOT NULL,
    avg_latency_ms REAL NOT NULL,
    p50_latency_ms REAL NOT NULL,
    p95_latency_ms REAL NOT NULL,
    p99_latency_ms REAL NOT NULL,
    memory_used_mb REAL NOT NULL,
    gpu_memory_used_mb REAL NOT NULL,
    power_watts REAL,
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    FOREIGN KEY (model_id) REFERENCES models(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_benchmarks_model_id ON benchmarks(model_id);
CREATE INDEX IF NOT EXISTS idx_benchmarks_created_at ON benchmarks(created_at);