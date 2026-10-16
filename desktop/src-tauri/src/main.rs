//! Desktop app for the release inbox: shows the server's web app in a native window, keeps
//! running in the system tray, starts with the OS if wanted and shows the server's
//! notifications natively.

// No console window next to the app in release builds on Windows.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod config;
mod notifications;
mod status;
mod tray;
mod window;
#[cfg(windows)]
mod windows_theme;

use std::collections::HashSet;
use std::sync::Mutex;

use tauri::Manager;

/// What the window, the tray and the commands share.
#[derive(Default)]
pub struct AppState {
    pub config: Mutex<config::Config>,
    /// Origins whose pages were given the server's permissions.
    pub allowed_origins: Mutex<HashSet<String>>,
    /// The inbox count the tray shows; `None` until the web app sent one.
    pub unread: Mutex<Option<u32>>,
    /// Whether notifications can arrive, as the tray shows it.
    pub connection: Mutex<status::Connection>,
}

/// Passed by the login item: the app starts in the tray, without showing its window.
const START_HIDDEN: &str = "--hidden";

fn main() {
    tauri::Builder::default()
        // Registered first: a second launch only brings the running app to the front.
        .plugin(tauri_plugin_single_instance::init(|app, args, _cwd| {
            if !args.iter().any(|arg| arg == START_HIDDEN) {
                window::show(app);
            }
        }))
        .plugin(
            tauri_plugin_autostart::Builder::new()
                .arg(START_HIDDEN)
                .build(),
        )
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_opener::init())
        .manage(AppState::default())
        .invoke_handler(tauri::generate_handler![
            commands::server_url,
            commands::check_server_url,
            commands::connect,
            commands::show_notification,
            commands::set_unread_count,
            commands::set_status,
        ])
        .setup(|app| {
            let handle = app.handle();
            let loaded = config::load(handle);
            let server = loaded.server_url();
            *app.state::<AppState>().config.lock().unwrap() = loaded;
            notifications::register(handle)?;
            tray::create(handle)?;
            // Started at login, the app waits in the tray; without a server it asks for one.
            let hidden = server.is_some() && std::env::args().any(|arg| arg == START_HIDDEN);
            window::create(handle, server.as_ref(), !hidden)?;
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("failed to build the app")
        .run(|_app, _event| {
            // A click on the Dock icon brings back the window that was closed to the tray.
            #[cfg(target_os = "macos")]
            if let tauri::RunEvent::Reopen {
                has_visible_windows: false,
                ..
            } = _event
            {
                window::show(_app);
            }
        });
}
