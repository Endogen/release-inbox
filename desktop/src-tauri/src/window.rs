//! The main window: the bundled setup page until a server is chosen, then the server's app.
//! Closing it only hides it, so the app keeps running in the tray.

use tauri::ipc::CapabilityBuilder;
use tauri::webview::NewWindowResponse;
use tauri::{
    AppHandle, Manager, Url, WebviewUrl, WebviewWindow, WebviewWindowBuilder, WindowEvent,
};
use tauri_plugin_notification::NotificationExt;
use tauri_plugin_opener::OpenerExt;

use crate::{AppState, config};

pub const MAIN: &str = "main";

/// Where the bundled setup page is served from.
fn setup_url() -> Url {
    let origin = if cfg!(windows) {
        "http://tauri.localhost/"
    } else {
        "tauri://localhost/"
    };
    Url::parse(origin)
        .and_then(|origin| origin.join("index.html"))
        .expect("valid URL")
}

fn is_same_origin(url: &Url, other: &Url) -> bool {
    url.origin() == other.origin()
}

/// Creates the main window; with `visible` false it loads in the background, for the tray.
pub fn create(
    app: &AppHandle,
    server: Option<&Url>,
    visible: bool,
) -> tauri::Result<WebviewWindow> {
    let start = match server {
        Some(server) => {
            allow_server(app, server)?;
            WebviewUrl::External(server.clone())
        }
        None => WebviewUrl::App("index.html".into()),
    };
    let navigation_app = app.clone();
    let new_window_app = app.clone();
    let window = WebviewWindowBuilder::new(app, MAIN, start)
        .title("Releases")
        .inner_size(1280.0, 820.0)
        .min_inner_size(380.0, 520.0)
        .visible(visible)
        // Links that leave the app, such as a release on github.com, open in the browser.
        .on_navigation(move |url| {
            let stays = is_same_origin(url, &setup_url())
                || current_server(&navigation_app)
                    .is_some_and(|server| is_same_origin(url, &server))
                || url.scheme() == "about";
            if !stays {
                open_in_browser(&navigation_app, url);
            }
            stays
        })
        .on_new_window(move |url, _features| {
            open_in_browser(&new_window_app, &url);
            NewWindowResponse::Deny
        })
        .build()?;

    let hide_app = app.clone();
    window.on_window_event(move |event| {
        if let WindowEvent::CloseRequested { api, .. } = event {
            api.prevent_close();
            hide(&hide_app);
        }
    });
    Ok(window)
}

fn current_server(app: &AppHandle) -> Option<Url> {
    app.state::<AppState>().config.lock().unwrap().server_url()
}

fn open_in_browser(app: &AppHandle, url: &Url) {
    if matches!(url.scheme(), "https" | "http" | "mailto") {
        let _ = app.opener().open_url(url.as_str(), None::<&str>);
    }
}

/// Lets the server's pages call the commands that connect the web app with the desktop.
/// Only pages of this origin get them; the setup page has its own, static capability.
pub fn allow_server(app: &AppHandle, server: &Url) -> tauri::Result<()> {
    let origin = server.origin().ascii_serialization();
    app.add_capability(
        CapabilityBuilder::new(format!("server:{origin}"))
            .remote(format!("{origin}/*"))
            .local(false)
            .window(MAIN)
            .permission("core:event:allow-listen")
            .permission("core:event:allow-unlisten")
            .permission("allow-show-notification")
            .permission("allow-set-unread-count"),
    )
}

/// Shows the server's app, or the setup page with `None`.
pub fn navigate(app: &AppHandle, server: Option<&Url>) -> tauri::Result<()> {
    let target = match server {
        Some(server) => {
            allow_server(app, server)?;
            server.clone()
        }
        None => setup_url(),
    };
    let window = app
        .get_webview_window(MAIN)
        .ok_or(tauri::Error::WindowNotFound)?;
    window.navigate(target)?;
    show(app);
    Ok(())
}

pub fn show(app: &AppHandle) {
    if let Some(window) = app.get_webview_window(MAIN) {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}

/// What a click on the tray icon does: brings the window to the front, or hides it if it
/// already is.
pub fn toggle(app: &AppHandle) {
    match app.get_webview_window(MAIN) {
        Some(window)
            if window.is_visible().unwrap_or(false) && window.is_focused().unwrap_or(false) =>
        {
            hide(app);
        }
        _ => show(app),
    }
}

/// Hides the window; the first time, a notification says where the app went.
pub fn hide(app: &AppHandle) {
    if let Some(window) = app.get_webview_window(MAIN) {
        let _ = window.hide();
    }
    let state = app.state::<AppState>();
    let mut config = state.config.lock().unwrap();
    if !config.tray_hint_shown {
        config.tray_hint_shown = true;
        let _ = config::save(app, &config);
        let _ = app
            .notification()
            .builder()
            .title("Releases is still running")
            .body("It keeps notifying you from the system tray. Quit it from the tray icon's menu.")
            .show();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn url(input: &str) -> Url {
        Url::parse(input).unwrap()
    }

    #[test]
    fn compares_origins() {
        let server = url("https://releases.example/");
        assert!(is_same_origin(
            &url("https://releases.example/inbox?release=1"),
            &server
        ));
        assert!(!is_same_origin(
            &url("https://github.com/acme/app"),
            &server
        ));
        assert!(!is_same_origin(&url("http://releases.example/"), &server));
    }
}
