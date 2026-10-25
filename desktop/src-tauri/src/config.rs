//! The desktop app's own settings, stored as JSON in the app's config folder.

use std::fs;
use std::path::PathBuf;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager, Url};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct Config {
    /// The server's address, as returned by [`normalize_server_url`].
    server_url: Option<String>,
    /// Whether the user was told once that closing the window keeps the app in the tray.
    pub tray_hint_shown: bool,
    /// Use a monochrome tray icon on macOS and Windows.
    pub monochrome_tray_icon: bool,
    /// Keep a tray icon and allow closing/hiding the window into it.
    pub tray_enabled: bool,
}

impl Default for Config {
    fn default() -> Self {
        Self {
            server_url: None,
            tray_hint_shown: false,
            monochrome_tray_icon: false,
            // Every older installation had a tray, regardless of its old tray_only setting.
            tray_enabled: true,
        }
    }
}

impl Config {
    pub fn server_url(&self) -> Option<Url> {
        self.server_url
            .as_deref()
            .and_then(|url| normalize_server_url(url).ok())
    }

    pub fn set_server_url(&mut self, server: &Url) {
        self.server_url = Some(server.to_string());
    }
}

fn path(app: &AppHandle) -> tauri::Result<PathBuf> {
    Ok(app.path().app_config_dir()?.join("config.json"))
}

/// The saved settings; the defaults if there are none yet or they can't be read.
pub fn load(app: &AppHandle) -> Config {
    path(app)
        .ok()
        .and_then(|path| fs::read(path).ok())
        .and_then(|bytes| serde_json::from_slice(&bytes).ok())
        .unwrap_or_default()
}

pub fn save(app: &AppHandle, config: &Config) -> Result<(), String> {
    let path = path(app).map_err(|error| error.to_string())?;
    if let Some(folder) = path.parent() {
        fs::create_dir_all(folder).map_err(|error| error.to_string())?;
    }
    let json = serde_json::to_vec_pretty(config).map_err(|error| error.to_string())?;
    fs::write(path, json).map_err(|error| format!("Couldn't save the settings: {error}"))
}

/// The origin of the server the user typed in, with a trailing slash: `releases.example.com`
/// becomes `https://releases.example.com/`. Paths are dropped, as the app runs at the root.
///
/// The host must be a plain host name or an IPv4 address: the origin becomes a URL pattern
/// for the server's permissions, where characters such as `*` would match other hosts.
pub fn normalize_server_url(input: &str) -> Result<Url, String> {
    let input = input.trim();
    if input.is_empty() {
        return Err("Enter the address of your server.".into());
    }
    let with_scheme = if input.contains("://") {
        input.to_owned()
    } else {
        format!("https://{input}")
    };
    let url = Url::parse(&with_scheme).map_err(|_| "That isn't a valid address.".to_owned())?;
    if !matches!(url.scheme(), "https" | "http") {
        return Err("The address must start with https:// or http://.".into());
    }
    let host = url.host_str().unwrap_or_default();
    let plain = |c: char| c.is_ascii_alphanumeric() || matches!(c, '-' | '.');
    if host.is_empty() || !host.chars().all(plain) {
        return Err("The address needs a host name, such as releases.example.com.".into());
    }
    Url::parse(&url.origin().ascii_serialization())
        .map_err(|_| "That isn't a valid address.".to_owned())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn normalized(input: &str) -> Result<String, String> {
        normalize_server_url(input).map(String::from)
    }

    #[test]
    fn adds_https_and_drops_the_path() {
        assert_eq!(
            normalized(" releases.example.com/inbox?x=1 ").unwrap(),
            "https://releases.example.com/"
        );
        assert_eq!(
            normalized("http://localhost:5173").unwrap(),
            "http://localhost:5173/"
        );
    }

    #[test]
    fn rejects_other_schemes_and_empty_input() {
        assert!(normalized("").is_err());
        assert!(normalized("ftp://example.com").is_err());
        assert!(normalized("file:///etc/passwd").is_err());
    }

    #[test]
    fn accepts_only_plain_host_names() {
        assert_eq!(
            normalized("192.168.1.5:8000").unwrap(),
            "https://192.168.1.5:8000/"
        );
        assert!(normalized("*.example.com").is_err());
        assert!(normalized("a(b.example").is_err());
        assert!(normalized("http://[::1]:5173").is_err());
    }

    #[test]
    fn reads_settings_without_newer_fields() {
        let config: Config =
            serde_json::from_str(r#"{"server_url":"https://a.example/"}"#).unwrap();
        assert_eq!(config.server_url().unwrap().as_str(), "https://a.example/");
        assert!(!config.tray_hint_shown);
        assert!(!config.monochrome_tray_icon);
        assert!(config.tray_enabled);
    }

    #[test]
    fn remembers_tray_preferences_without_losing_server_settings() {
        let mut config = Config::default();
        config.set_server_url(&Url::parse("https://a.example/").unwrap());
        config.monochrome_tray_icon = true;
        config.tray_enabled = false;
        let saved = serde_json::to_string(&config).unwrap();
        let restored: Config = serde_json::from_str(&saved).unwrap();
        assert!(restored.monochrome_tray_icon);
        assert!(!restored.tray_enabled);
        assert_eq!(restored.server_url(), config.server_url());
    }

    #[test]
    fn old_taskbar_preference_does_not_disable_the_tray() {
        for tray_only in [true, false] {
            let config: Config = serde_json::from_value(serde_json::json!({
                "tray_only": tray_only,
                "tray_hint_shown": true,
                "monochrome_tray_icon": true,
            }))
            .unwrap();
            assert!(config.tray_enabled);
            assert!(config.tray_hint_shown);
            assert!(config.monochrome_tray_icon);
            assert!(
                !serde_json::to_value(config)
                    .unwrap()
                    .as_object()
                    .unwrap()
                    .contains_key("tray_only")
            );
        }
    }
}
