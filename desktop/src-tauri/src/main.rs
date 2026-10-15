//! Desktop app for the release inbox: shows the server's web app in a native window, keeps
//! running in the system tray and shows the server's notifications natively.

// No console window next to the app in release builds on Windows.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod config;
mod tray;
mod window;

use std::sync::Mutex;

use tauri::{Emitter, Manager};
use tauri_plugin_notification::NotificationExt;

/// The desktop app's settings, shared by the window, the tray and the commands.
#[derive(Default)]
pub struct AppState {
    pub config: Mutex<config::Config>,
}

/// Asks the web app to show a path inside it, such as `/inbox?release=1`.
const NAVIGATE_EVENT: &str = "desktop://navigate";

fn main() {
    tauri::Builder::default()
        // Registered first: a second launch only brings the running app to the front.
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            window::show(app);
        }))
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_opener::init())
        .manage(AppState::default())
        .invoke_handler(tauri::generate_handler![
            commands::server_url,
            commands::check_server_url,
            commands::connect,
            commands::show_notification,
            commands::set_unread_count,
        ])
        .setup(|app| {
            let handle = app.handle();
            let loaded = config::load(handle);
            let server = loaded.server_url();
            *app.state::<AppState>().config.lock().unwrap() = loaded;
            tray::create(handle)?;
            window::create(handle, server.as_ref())?;

            // A click on a notification opens the release it is about.
            let clicked = handle.clone();
            app.notification().on_action(move |action| {
                if action.action_id() != "tap" {
                    return;
                }
                window::show(&clicked);
                let url = action
                    .notification()
                    .and_then(|notification| notification.extra().get(commands::URL_EXTRA))
                    .and_then(|url| url.as_str());
                if let Some(url) = url {
                    let _ = clicked.emit_to(window::MAIN, NAVIGATE_EVENT, url);
                }
            })?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("failed to run the app");
}
