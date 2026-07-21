pub fn get_migrations() -> Vec<tauri_plugin_sql::Migration> {
    vec![
        tauri_plugin_sql::Migration {
            version: 1,
            description: "Create models table",
            sql: include_str!("../../migrations/001_create_models.sql"),
            kind: tauri_plugin_sql::MigrationKind::Up,
        },
        tauri_plugin_sql::Migration {
            version: 2,
            description: "Create benchmarks table",
            sql: include_str!("../../migrations/002_create_benchmarks.sql"),
            kind: tauri_plugin_sql::MigrationKind::Up,
        },
        tauri_plugin_sql::Migration {
            version: 3,
            description: "Create processes table",
            sql: include_str!("../../migrations/003_create_processes.sql"),
            kind: tauri_plugin_sql::MigrationKind::Up,
        },
        tauri_plugin_sql::Migration {
            version: 4,
            description: "Add model metadata",
            sql: include_str!("../../migrations/004_add_model_metadata.sql"),
            kind: tauri_plugin_sql::MigrationKind::Up,
        },
        tauri_plugin_sql::Migration {
            version: 5,
            description: "Create notifications table",
            sql: include_str!("../../migrations/005_create_notifications.sql"),
            kind: tauri_plugin_sql::MigrationKind::Up,
        },
    ]
}
