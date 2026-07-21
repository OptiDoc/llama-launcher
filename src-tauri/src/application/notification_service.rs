use std::path::PathBuf;
use sqlx::Row;
use tauri::Emitter;
use tauri::Manager;
use tauri::State;
use tauri_plugin_sql::DbInstances;

use crate::domain::{NotificationEvent, NotificationLevel, NotificationSource};

const DB_NAME: &str = "sqlite:llama-launcher.db";

pub struct NotificationService {
    app: tauri::AppHandle,
}

impl NotificationService {
    pub fn new(app: tauri::AppHandle) -> Self {
        Self { app }
    }

    pub async fn emit(
        &self,
        event: NotificationEvent,
        db: State<'_, DbInstances>,
    ) -> Result<(), String> {
        self.persist(&event, db.clone()).await?;
        let payload = serde_json::to_string(&event).map_err(|e| format!("Serialize error: {}", e))?;
        self.app
            .emit("notification", payload)
            .map_err(|e| format!("Emit error: {}", e))?;
        Ok(())
    }

    async fn get_db_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
        let app_path = app
            .path()
            .app_config_dir()
            .map_err(|e| format!("Failed to get app config dir: {}", e))?;
        Ok(app_path.join("llama-launcher.db"))
    }

    async fn persist(
        &self,
        event: &NotificationEvent,
        db: State<'_, DbInstances>,
    ) -> Result<(), String> {
        let instances = db.0.read().await;
        let _pool = instances
            .get(DB_NAME)
            .ok_or_else(|| format!("DB {} not loaded", DB_NAME))?;
        drop(instances);

        let db_path = Self::get_db_path(&self.app).await?;
        let db_url = format!("sqlite:{}", db_path.display());

        let pool = sqlx::SqlitePool::connect(&db_url)
            .await
            .map_err(|e| format!("Failed to connect to DB: {}", e))?;

        sqlx::query(r#"
            INSERT INTO notifications (id, level, source, title, body, timestamp, instance_id, action_label, read)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, false)
        "#)
        .bind(&event.id)
        .bind(serde_json::to_string(&event.level).unwrap_or_default())
        .bind(serde_json::to_string(&event.source).unwrap_or_default())
        .bind(&event.title)
        .bind(&event.body)
        .bind(event.timestamp as i64)
        .bind(event.instance_id.as_deref().unwrap_or(""))
        .bind(event.action_label.as_deref().unwrap_or(""))
        .execute(&pool)
        .await
        .map_err(|e| format!("SQL insert error: {}", e))?;

        pool.close().await;
        Ok(())
    }

    pub async fn get_notifications(
        &self,
        db: State<'_, DbInstances>,
    ) -> Result<Vec<NotificationEvent>, String> {
        let instances = db.0.read().await;
        let _pool = instances
            .get(DB_NAME)
            .ok_or_else(|| format!("DB {} not loaded", DB_NAME))?;
        drop(instances);

        let db_path = Self::get_db_path(&self.app).await?;
        let db_url = format!("sqlite:{}", db_path.display());

        let pool = sqlx::SqlitePool::connect(&db_url)
            .await
            .map_err(|e| format!("Failed to connect to DB: {}", e))?;

        let rows = sqlx::query(r#"
            SELECT id, level, source, title, body, timestamp, instance_id, action_label
            FROM notifications ORDER BY timestamp DESC
        "#)
        .fetch_all(&pool)
        .await
        .map_err(|e| format!("SQL query error: {}", e))?;

        pool.close().await;

        let mut notifications = Vec::new();
        for row in rows {
            let id: String = row.get("id");
            let level_str: String = row.get("level");
            let source_str: String = row.get("source");
            let title: String = row.get("title");
            let body: String = row.get("body");
            let timestamp: i64 = row.get("timestamp");
            let instance_id: String = row.get("instance_id");
            let action_label: String = row.get("action_label");

            let level: NotificationLevel =
                serde_json::from_str(&format!("\"{}\"", level_str)).unwrap_or(NotificationLevel::Info);
            let source: NotificationSource =
                serde_json::from_str(&format!("\"{}\"", source_str)).unwrap_or(NotificationSource::System);

            notifications.push(NotificationEvent {
                id,
                level,
                source,
                title,
                body,
                timestamp: timestamp as u64,
                instance_id: if instance_id.is_empty() { None } else { Some(instance_id) },
                action_label: if action_label.is_empty() { None } else { Some(action_label) },
            });
        }
        Ok(notifications)
    }

    pub async fn clear_notifications(
        &self,
        db: State<'_, DbInstances>,
    ) -> Result<(), String> {
        let instances = db.0.read().await;
        let _pool = instances
            .get(DB_NAME)
            .ok_or_else(|| format!("DB {} not loaded", DB_NAME))?;
        drop(instances);

        let db_path = Self::get_db_path(&self.app).await?;
        let db_url = format!("sqlite:{}", db_path.display());

        let pool = sqlx::SqlitePool::connect(&db_url)
            .await
            .map_err(|e| format!("Failed to connect to DB: {}", e))?;

        sqlx::query("DELETE FROM notifications")
            .execute(&pool)
            .await
            .map_err(|e| format!("SQL delete error: {}", e))?;

        pool.close().await;
        Ok(())
    }

    pub async fn mark_read(
        &self,
        id: &str,
        db: State<'_, DbInstances>,
    ) -> Result<(), String> {
        let instances = db.0.read().await;
        let _pool = instances
            .get(DB_NAME)
            .ok_or_else(|| format!("DB {} not loaded", DB_NAME))?;
        drop(instances);

        let db_path = Self::get_db_path(&self.app).await?;
        let db_url = format!("sqlite:{}", db_path.display());

        let pool = sqlx::SqlitePool::connect(&db_url)
            .await
            .map_err(|e| format!("Failed to connect to DB: {}", e))?;

        sqlx::query("UPDATE notifications SET read = true WHERE id = ?1")
            .bind(id)
            .execute(&pool)
            .await
            .map_err(|e| format!("SQL update error: {}", e))?;

        pool.close().await;
        Ok(())
    }

    pub async fn mark_all_read(
        &self,
        db: State<'_, DbInstances>,
    ) -> Result<(), String> {
        let instances = db.0.read().await;
        let _pool = instances
            .get(DB_NAME)
            .ok_or_else(|| format!("DB {} not loaded", DB_NAME))?;
        drop(instances);

        let db_path = Self::get_db_path(&self.app).await?;
        let db_url = format!("sqlite:{}", db_path.display());

        let pool = sqlx::SqlitePool::connect(&db_url)
            .await
            .map_err(|e| format!("Failed to connect to DB: {}", e))?;

        sqlx::query("UPDATE notifications SET read = true")
            .execute(&pool)
            .await
            .map_err(|e| format!("SQL update error: {}", e))?;

        pool.close().await;
        Ok(())
    }
}
