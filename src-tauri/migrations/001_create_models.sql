-- Migration 001: Create models table
CREATE TABLE IF NOT EXISTS models (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    path TEXT NOT NULL,
    size INTEGER NOT NULL,
    format TEXT NOT NULL,
    architecture TEXT,
    quantization TEXT,
    context_size INTEGER,
    parameter_count TEXT,
    modified INTEGER NOT NULL,
    metadata TEXT NOT NULL DEFAULT '{}',
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_models_path ON models(path);
CREATE INDEX IF NOT EXISTS idx_models_name ON models(name);
CREATE INDEX IF NOT EXISTS idx_models_format ON models(format);
CREATE INDEX IF NOT EXISTS idx_models_modified ON models(modified);