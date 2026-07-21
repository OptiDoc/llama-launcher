use tauri_plugin_sql::DbInstances;

use crate::application::NotificationService;
use crate::domain::NotificationEvent;

#[tauri::command]
pub async fn get_notifications(
    service: tauri::State<'_, NotificationService>,
    db: tauri::State<'_, DbInstances>,
) -> Result<Vec<NotificationEvent>, String> {
    service.get_notifications(db).await
}

#[tauri::command]
pub async fn clear_notifications(
    service: tauri::State<'_, NotificationService>,
    db: tauri::State<'_, DbInstances>,
) -> Result<(), String> {
    service.clear_notifications(db).await
}
