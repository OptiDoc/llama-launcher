-- Migration 004: Add model metadata columns
ALTER TABLE models ADD COLUMN huggingface_id TEXT;
ALTER TABLE models ADD COLUMN tags TEXT DEFAULT '[]';
ALTER TABLE models ADD COLUMN license TEXT;
ALTER TABLE models ADD COLUMN author TEXT;
ALTER TABLE models ADD COLUMN description TEXT;
ALTER TABLE models ADD COLUMN sha256 TEXT;
ALTER TABLE models ADD COLUMN download_url TEXT;

CREATE INDEX IF NOT EXISTS idx_models_huggingface_id ON models(huggingface_id);