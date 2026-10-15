//! Commands the web pages call: the setup page to choose the server, the server's app to show
//! notifications and the number of inbox entries.

use serde::Deserialize;
use tauri::{AppHandle, State};
use tauri_plugin_notification::NotificationExt;

use crate::{AppState, config, tray, window};

#[tauri::command]
pub fn server_url(state: State<'_, AppState>) -> Option<String> {
    state.config.lock().unwrap().server_url().map(String::from)
}

/// The address as the app will use it, or why it can't be used.
#[tauri::command]
pub fn check_server_url(url: String) -> Result<String, String> {
    config::normalize_server_url(&url).map(String::from)
}

/// Saves the server and shows its app.
#[tauri::command]
pub fn connect(app: AppHandle, state: State<'_, AppState>, url: String) -> Result<(), String> {
    let server = config::normalize_server_url(&url)?;
    {
        let mut config = state.config.lock().unwrap();
        config.server_url = Some(server.to_string());
        config::save(&app, &config)?;
    }
    window::navigate(&app, Some(&server)).map_err(|error| error.to_string())
}

/// A `notification` event of the server's event stream, as far as the desktop uses it.
#[derive(Debug, Deserialize)]
pub struct ServerNotification {
    title: String,
    body: String,
    /// Where it leads inside the app, e.g. `/inbox?release=1`.
    url: String,
}

/// The notification's `extra` that holds where a click on it leads.
pub const URL_EXTRA: &str = "url";

#[tauri::command]
pub fn show_notification(app: AppHandle, notification: ServerNotification) -> Result<(), String> {
    app.notification()
        .builder()
        .title(notification.title)
        .body(notification.body)
        .extra(URL_EXTRA, notification.url)
        .show()
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn set_unread_count(app: AppHandle, count: u32) -> Result<(), String> {
    tray::set_unread(&app, count).map_err(|error| error.to_string())
}
