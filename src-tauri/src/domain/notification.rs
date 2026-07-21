use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum NotificationLevel {
    Info,
    Success,
    Warning,
    Error,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum NotificationSource {
    Model,
    Process,
    System,
    Release,
    Download,
    Workspace,
    Config,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NotificationEvent {
    pub id: String,
    pub level: NotificationLevel,
    pub source: NotificationSource,
    pub title: String,
    pub body: String,
    pub timestamp: u64,
    pub instance_id: Option<String>,
    pub action_label: Option<String>,
}

impl NotificationEvent {
    pub fn new(level: NotificationLevel, source: NotificationSource, title: String, body: String) -> Self {
        Self {
            id: uuid::Uuid::new_v4().to_string(),
            level,
            source,
            title,
            body,
            timestamp: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_millis() as u64,
            instance_id: None,
            action_label: None,
        }
    }

    pub fn with_instance(mut self, instance_id: String) -> Self {
        self.instance_id = Some(instance_id);
        self
    }

    pub fn with_action(mut self, label: String) -> Self {
        self.action_label = Some(label);
        self
    }
}
