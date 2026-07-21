-- Migration 003: Create processes table
CREATE TABLE IF NOT EXISTS processes (
    id TEXT PRIMARY KEY,
    model_id TEXT NOT NULL,
    pid INTEGER,
    port INTEGER NOT NULL,
    status TEXT NOT NULL,
    started_at INTEGER NOT NULL,
    stopped_at INTEGER,
    config TEXT NOT NULL DEFAULT '{}',
    metrics TEXT NOT NULL DEFAULT '{}',
    stdout_log TEXT,
    stderr_log TEXT,
    FOREIGN KEY (model_id) REFERENCES models(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_processes_model_id ON processes(model_id);
CREATE INDEX IF NOT EXISTS idx_processes_status ON processes(status);
CREATE INDEX IF NOT EXISTS idx_processes_started_at ON processes(started_at);