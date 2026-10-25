fn main() {
    tauri_build::try_build(tauri_build::Attributes::new().app_manifest(
        // Each command gets an `allow-<command>` permission, so the capabilities decide which
        // pages may call it: the setup page or the server's app.
        tauri_build::AppManifest::new().commands(&[
            "server_url",
            "check_server_url",
            "connect",
            "show_notification",
            "set_unread_count",
            "set_status",
            "desktop_settings",
            "set_tray_enabled",
        ]),
    ))
    .expect("failed to run tauri-build");
}
