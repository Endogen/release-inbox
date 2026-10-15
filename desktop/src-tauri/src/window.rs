//! The main window: the bundled setup page until a server is chosen, then the server's app.
//! Closing it only hides it, so the app keeps running in the tray.

use tauri::ipc::CapabilityBuilder;
use tauri::utils::config::BackgroundThrottlingPolicy;
use tauri::webview::NewWindowResponse;
use tauri::{AppHandle, Manager, Url, Webview, WebviewUrl, WebviewWindowBuilder, WindowEvent};
use tauri_plugin_notification::NotificationExt;
use tauri_plugin_opener::OpenerExt;

use crate::{AppState, config, tray};

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
pub fn create(app: &AppHandle, server: Option<&Url>, visible: bool) -> tauri::Result<()> {
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
        // The page keeps receiving notifications while the window is in the tray. Only macOS
        // lets the app turn off the throttling of hidden pages.
        .background_throttling(BackgroundThrottlingPolicy::Disabled)
        // On macOS and Linux this also sees navigations of frames; the app has none.
        .on_navigation(move |url| may_show(&navigation_app, url))
        .on_new_window(move |url, _features| {
            open_in_browser(&new_window_app, &url);
            NewWindowResponse::Deny
        })
        .build()?;

    let close_app = app.clone();
    window.on_window_event(move |event| {
        if let WindowEvent::CloseRequested { api, .. } = event {
            api.prevent_close();
            close_to_tray(&close_app);
        }
    });
    Ok(())
}

/// Whether the window may show `url`: the setup page and the server's pages. The server's
/// redirect from http to https is followed, and the https address becomes the server's.
/// Anything else, such as a release on github.com, opens in the browser.
fn may_show(app: &AppHandle, url: &Url) -> bool {
    if url.scheme() == "about" || is_same_origin(url, &setup_url()) {
        return true;
    }
    let server = current_server(app);
    if server
        .as_ref()
        .is_some_and(|server| is_same_origin(url, server))
    {
        return true;
    }
    if server.is_some_and(|server| is_https_upgrade(&server, url))
        && let Ok(upgraded) = config::normalize_server_url(url.as_str())
        && use_server(app, &upgraded).is_ok()
    {
        return true;
    }
    open_in_browser(app, url);
    false
}

/// Whether `url` is `server` on https, as servers redirect plain http requests.
fn is_https_upgrade(server: &Url, url: &Url) -> bool {
    server.scheme() == "http" && url.scheme() == "https" && server.host() == url.host()
}

pub fn current_server(app: &AppHandle) -> Option<Url> {
    app.state::<AppState>().config.lock().unwrap().server_url()
}

/// Rejects calls from pages that aren't the current server's: the permissions of a server
/// the user switched away from stay granted until the app restarts.
pub fn require_server_page(app: &AppHandle, webview: &Webview) -> Result<(), String> {
    let on_server = webview
        .url()
        .ok()
        .zip(current_server(app))
        .is_some_and(|(url, server)| is_same_origin(&url, &server));
    on_server
        .then_some(())
        .ok_or_else(|| "Only the server's app may do this.".to_owned())
}

fn open_in_browser(app: &AppHandle, url: &Url) {
    if matches!(url.scheme(), "https" | "http" | "mailto") {
        let _ = app.opener().open_url(url.as_str(), None::<&str>);
    }
}

/// Saves `server` as the one to show and lets its pages use the desktop.
pub fn use_server(app: &AppHandle, server: &Url) -> Result<(), String> {
    let config = {
        let state = app.state::<AppState>();
        let mut config = state.config.lock().unwrap();
        config.set_server_url(server);
        config.clone()
    };
    config::save(app, &config)?;
    allow_server(app, server).map_err(|error| error.to_string())
}

/// Lets the server's pages call the commands that connect the web app with the desktop.
/// Only pages of this origin get them; the setup page has its own, static capability.
fn allow_server(app: &AppHandle, server: &Url) -> tauri::Result<()> {
    let origin = server.origin().ascii_serialization();
    let added = app
        .state::<AppState>()
        .allowed_origins
        .lock()
        .unwrap()
        .insert(origin.clone());
    if !added {
        return Ok(());
    }
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

/// Shows the server's app, or the setup page with `None`, from the start.
pub fn navigate(app: &AppHandle, server: Option<&Url>) -> tauri::Result<()> {
    let target = match server {
        Some(server) => {
            allow_server(app, server)?;
            server.clone()
        }
        None => setup_url(),
    };
    // The page that is left can't clear its count any more; the next one sets its own.
    tray::set_unread(app, 0)?;
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

fn hide(app: &AppHandle) {
    if let Some(window) = app.get_webview_window(MAIN) {
        let _ = window.hide();
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

/// Closing the window hides it; the first time, a notification says where the app went.
fn close_to_tray(app: &AppHandle) {
    hide(app);
    let first_time = {
        let state = app.state::<AppState>();
        let mut config = state.config.lock().unwrap();
        let first_time = !config.tray_hint_shown;
        config.tray_hint_shown = true;
        first_time.then(|| config.clone())
    };
    if let Some(config) = first_time {
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

    #[test]
    fn follows_only_the_servers_own_https_upgrade() {
        let server = url("http://releases.example/");
        assert!(is_https_upgrade(
            &server,
            &url("https://releases.example/inbox")
        ));
        assert!(!is_https_upgrade(
            &server,
            &url("https://www.releases.example/")
        ));
        assert!(!is_https_upgrade(
            &url("https://releases.example/"),
            &url("https://releases.example/")
        ));
    }
}
