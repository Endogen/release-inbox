//! Commands the web pages call: the setup page to choose the server, the server's app to show
//! notifications, the number of inbox entries and whether notifications can arrive.

use tauri::{AppHandle, Webview};

use crate::notifications::{self, ServerNotification};
use crate::status::{self, Status};
use crate::{config, tray, window};

#[tauri::command]
pub fn server_url(app: AppHandle) -> Option<String> {
    window::current_server(&app).map(String::from)
}

/// The address as the app will use it, or why it can't be used.
#[tauri::command]
pub fn check_server_url(url: String) -> Result<String, String> {
    config::normalize_server_url(&url).map(String::from)
}

/// Saves the server and shows its app.
#[tauri::command]
pub fn connect(app: AppHandle, url: String) -> Result<(), String> {
    let server = config::normalize_server_url(&url)?;
    window::use_server(&app, &server)?;
    window::navigate(&app, Some(&server)).map_err(|error| error.to_string())
}

/// Shows a notification of the server; one about releases gets buttons that act on them.
#[tauri::command]
pub fn show_notification(
    app: AppHandle,
    webview: Webview,
    notification: ServerNotification,
) -> Result<(), String> {
    window::require_server_page(&app, &webview)?;
    notifications::show(&app, notification).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn set_unread_count(app: AppHandle, webview: Webview, count: u32) -> Result<(), String> {
    window::require_server_page(&app, &webview)?;
    tray::set_unread(&app, count).map_err(|error| error.to_string())
}

/// What the server's app reports: signed in and connected, signed out or disconnected.
#[tauri::command]
pub fn set_status(app: AppHandle, webview: Webview, status: Status) -> Result<(), String> {
    window::require_server_page(&app, &webview)?;
    status::set(&app, status).map_err(|error| error.to_string())
}
