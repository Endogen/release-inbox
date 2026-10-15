//! The desktop app's own settings, stored as JSON in the app's config folder.

use std::fs;
use std::path::PathBuf;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager, Url};

#[derive(Debug, Default, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct Config {
    /// The server's address, as returned by [`normalize_server_url`].
    pub server_url: Option<String>,
    /// Whether the user was told once that closing the window keeps the app in the tray.
    pub tray_hint_shown: bool,
}

impl Config {
    pub fn server_url(&self) -> Option<Url> {
        self.server_url
            .as_deref()
            .and_then(|url| normalize_server_url(url).ok())
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
    if url.host_str().is_none_or(str::is_empty) {
        return Err("The address needs a host name.".into());
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
    fn reads_settings_without_newer_fields() {
        let config: Config =
            serde_json::from_str(r#"{"server_url":"https://a.example/"}"#).unwrap();
        assert_eq!(config.server_url().unwrap().as_str(), "https://a.example/");
        assert!(!config.tray_hint_shown);
    }
}
