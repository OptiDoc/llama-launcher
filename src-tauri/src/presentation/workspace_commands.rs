use tauri::AppHandle;
use tauri_plugin_store::StoreExt;

use crate::{log_info, Workspace, WorkspaceSettings};

const WORKSPACES_KEY: &str = "workspaces";
const WS_SETTINGS_KEY: &str = "workspace_settings";
const ACTIVE_WS_KEY: &str = "active_workspace";

fn load_json<T: for<'de> serde::Deserialize<'de>>(app: &AppHandle, store_name: &str, key: &str) -> Option<T> {
    let store = app.store(store_name).ok()?;
    let val = store.get(key)?;
    serde_json::from_value(val).ok()
}

fn save_json<T: serde::Serialize>(app: &AppHandle, store_name: &str, key: &str, value: &T) -> Result<(), String> {
    let store = app.store(store_name).map_err(|e| e.to_string())?;
    store.set(key, serde_json::to_value(value).map_err(|e| e.to_string())?);
    let _ = store.save();
    Ok(())
}

fn default_workspaces() -> Vec<Workspace> {
    vec![
        Workspace {
            id: "ws_personal".to_string(),
            name: "Personal".to_string(),
            color: "blue".to_string(),
            description: Some("Local dev & experiments".to_string()),
        },
        Workspace {
            id: "ws_team".to_string(),
            name: "Team Production".to_string(),
            color: "green".to_string(),
            description: Some("Shared serving profiles".to_string()),
        },
    ]
}

#[tauri::command]
pub async fn list_workspaces(app: AppHandle) -> Result<Vec<Workspace>, String> {
    let workspaces: Vec<Workspace> = load_json(&app, "workspaces.json", WORKSPACES_KEY)
        .unwrap_or_else(default_workspaces);
    Ok(workspaces)
}

#[tauri::command]
pub async fn create_workspace(
    app: AppHandle,
    name: String,
    color: String,
    description: Option<String>,
) -> Result<Workspace, String> {
    let mut workspaces: Vec<Workspace> = load_json(&app, "workspaces.json", WORKSPACES_KEY)
        .unwrap_or_else(default_workspaces);

    let id = format!("ws_{}", uuid::Uuid::new_v4().simple());
    let ws = Workspace {
        id: id.clone(),
        name,
        color,
        description,
    };
    workspaces.push(ws.clone());
    save_json(&app, "workspaces.json", WORKSPACES_KEY, &workspaces)?;
    log_info!(&format!("Created workspace: {}", ws.id), "workspaces");
    Ok(ws)
}

#[tauri::command]
pub async fn update_workspace(
    app: AppHandle,
    id: String,
    name: Option<String>,
    color: Option<String>,
    description: Option<Option<String>>,
) -> Result<(), String> {
    let mut workspaces: Vec<Workspace> = load_json(&app, "workspaces.json", WORKSPACES_KEY)
        .unwrap_or_else(default_workspaces);

    let ws = workspaces.iter_mut().find(|w| w.id == id)
        .ok_or("Workspace not found")?;

    if let Some(n) = name { ws.name = n; }
    if let Some(c) = color { ws.color = c; }
    if let Some(d) = description { ws.description = d; }

    save_json(&app, "workspaces.json", WORKSPACES_KEY, &workspaces)?;
    Ok(())
}

#[tauri::command]
pub async fn delete_workspace(app: AppHandle, id: String) -> Result<(), String> {
    let mut workspaces: Vec<Workspace> = load_json(&app, "workspaces.json", WORKSPACES_KEY)
        .unwrap_or_else(default_workspaces);

    if workspaces.len() <= 1 {
        return Err("Cannot delete the last workspace".to_string());
    }

    workspaces.retain(|w| w.id != id);
    save_json(&app, "workspaces.json", WORKSPACES_KEY, &workspaces)?;
    Ok(())
}

#[tauri::command]
pub async fn get_active_workspace(app: AppHandle) -> Result<String, String> {
    let id: String = load_json(&app, "workspaces.json", ACTIVE_WS_KEY)
        .unwrap_or_else(|| "ws_personal".to_string());
    Ok(id)
}

#[tauri::command]
pub async fn set_active_workspace(app: AppHandle, id: String) -> Result<(), String> {
    save_json(&app, "workspaces.json", ACTIVE_WS_KEY, &id)?;
    Ok(())
}

#[tauri::command]
pub async fn get_workspace_settings(
    app: AppHandle,
    workspace_id: String,
) -> Result<WorkspaceSettings, String> {
    let settings_map: std::collections::HashMap<String, WorkspaceSettings> =
        load_json(&app, "workspaces.json", WS_SETTINGS_KEY)
            .unwrap_or_default();

    Ok(settings_map.get(&workspace_id).cloned().unwrap_or_default())
}

#[tauri::command]
pub async fn update_workspace_settings(
    app: AppHandle,
    workspace_id: String,
    settings: WorkspaceSettings,
) -> Result<(), String> {
    let mut settings_map: std::collections::HashMap<String, WorkspaceSettings> =
        load_json(&app, "workspaces.json", WS_SETTINGS_KEY)
            .unwrap_or_default();

    settings_map.insert(workspace_id, settings);
    save_json(&app, "workspaces.json", WS_SETTINGS_KEY, &settings_map)?;
    Ok(())
}
