//! The tray icon: toggles the window, shows whether notifications can arrive and whether the
//! inbox has entries, and offers the app's menu. It stays after the window is closed, until
//! the user quits.

use std::sync::OnceLock;

use tauri::image::Image;
use tauri::menu::{CheckMenuItem, Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_autostart::ManagerExt;

use crate::status::Status;
use crate::{AppState, config, window};

const TRAY: &str = "tray";
const ICON: &[u8] = include_bytes!("../icons/64x64.png");
const TEMPLATE_ICON: &[u8] = include_bytes!("../icons/tray-template.png");

/// Asks the web app to sync; it does the work with its signed-in session.
const SYNC_EVENT: &str = "desktop://sync";

/// The menu's first item, which only shows whether notifications can arrive.
struct StatusItem(MenuItem<tauri::Wry>);

pub fn create(app: &AppHandle) -> tauri::Result<()> {
    let status = MenuItem::with_id(
        app,
        "status",
        Status::default().describe(),
        false,
        None::<&str>,
    )?;
    let autostart = CheckMenuItem::with_id(
        app,
        "autostart",
        "Start at login",
        true,
        starts_at_login(app),
        None::<&str>,
    )?;
    let menu = Menu::with_items(
        app,
        &[
            &status,
            &PredefinedMenuItem::separator(app)?,
            &MenuItem::with_id(app, "open", "Open Releases", true, None::<&str>)?,
            &MenuItem::with_id(app, "sync", "Sync now", true, None::<&str>)?,
            &MenuItem::with_id(app, "reload", "Reload", true, None::<&str>)?,
            &PredefinedMenuItem::separator(app)?,
            &autostart,
            &MenuItem::with_id(app, "server", "Change server…", true, None::<&str>)?,
            &PredefinedMenuItem::separator(app)?,
            &MenuItem::with_id(app, "quit", "Quit Releases", true, None::<&str>)?,
        ],
    )?;
    #[cfg(any(target_os = "macos", windows))]
    let monochrome = CheckMenuItem::with_id(
        app,
        "monochrome",
        "Monochrome icon",
        true,
        uses_monochrome(app),
        None::<&str>,
    )?;
    // Right after "Start at login", below the status line and its separator.
    #[cfg(any(target_os = "macos", windows))]
    menu.insert(&monochrome, 7)?;
    TrayIconBuilder::with_id(TRAY)
        .icon(current_icon(0, uses_monochrome(app)).clone())
        .icon_as_template(uses_monochrome(app))
        .tooltip(tooltip(0, Status::default()))
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(move |app, event| match event.id().as_ref() {
            "open" => window::show(app),
            "sync" => {
                let _ = app.emit_to(window::MAIN, SYNC_EVENT, ());
            }
            // Loads the app again, e.g. after the server wasn't reachable when it started.
            "reload" => {
                let _ = window::navigate(app, window::current_server(app).as_ref());
            }
            "autostart" => toggle_autostart(app, &autostart),
            #[cfg(any(target_os = "macos", windows))]
            "monochrome" => toggle_monochrome(app, &monochrome),
            "server" => {
                let _ = window::navigate(app, None);
            }
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                window::toggle(tray.app_handle());
            }
        })
        .build(app)?;
    #[cfg(windows)]
    watch_taskbar_theme(app);
    app.manage(StatusItem(status));
    refresh(app)?;
    let count = app.state::<AppState>().unread.lock().unwrap().unwrap_or(0);
    update_icon(app, count)
}

fn starts_at_login(app: &AppHandle) -> bool {
    app.autolaunch().is_enabled().unwrap_or(false)
}

fn uses_monochrome(app: &AppHandle) -> bool {
    cfg!(any(target_os = "macos", windows))
        && app
            .state::<AppState>()
            .config
            .lock()
            .unwrap()
            .monochrome_tray_icon
}

#[cfg(any(target_os = "macos", windows))]
fn toggle_monochrome(app: &AppHandle, item: &CheckMenuItem<tauri::Wry>) {
    let result = (|| -> Result<(), String> {
        let state = app.state::<AppState>();
        let mut current = state.config.lock().unwrap();
        let mut updated = current.clone();
        updated.monochrome_tray_icon = !updated.monochrome_tray_icon;
        config::save(app, &updated)?;
        *current = updated;
        drop(current);
        let count = state.unread.lock().unwrap().unwrap_or(0);
        update_icon(app, count).map_err(|error| error.to_string())
    })();
    if let Err(error) = result {
        eprintln!("Couldn't change the tray icon: {error}");
    }
    // Native check items toggle before the callback; restore the saved value on failure.
    let _ = item.set_checked(uses_monochrome(app));
}

/// Whether hiding to the tray is enabled on this installation.
pub fn is_enabled(app: &AppHandle) -> bool {
    app.state::<AppState>().config.lock().unwrap().tray_enabled
}

/// Apply immediately, preserving a way to reopen the app if a platform call or saving fails.
pub fn set_enabled(app: &AppHandle, enabled: bool) -> Result<(), String> {
    let mut updated = app.state::<AppState>().config.lock().unwrap().clone();
    let previous = updated.tray_enabled;
    if enabled == previous {
        return Ok(());
    }
    // Restore the window and taskbar/Dock before removing its alternative entry point.
    if !enabled {
        window::try_show(app).map_err(|error| error.to_string())?;
    }
    updated.tray_enabled = enabled;
    let result = set_visible(app, enabled)
        .map_err(|error| error.to_string())
        .and_then(|()| config::save(app, &updated));
    if let Err(error) = result {
        if let Err(restore_error) = set_visible(app, previous) {
            eprintln!("Couldn't restore the tray icon: {restore_error}");
        }
        return Err(error);
    }
    *app.state::<AppState>().config.lock().unwrap() = updated;
    Ok(())
}

fn set_visible(app: &AppHandle, visible: bool) -> tauri::Result<()> {
    if let Some(tray) = app.tray_by_id(TRAY) {
        tray.set_visible(visible)?;
    } else if visible {
        create(app)?;
    }
    Ok(())
}

fn update_icon(app: &AppHandle, count: u32) -> tauri::Result<()> {
    if let Some(tray) = app.tray_by_id(TRAY) {
        let monochrome = uses_monochrome(app);
        tray.set_icon_with_as_template(Some(current_icon(count, monochrome).clone()), monochrome)?;
    }
    Ok(())
}

fn current_icon(count: u32, monochrome: bool) -> &'static Image<'static> {
    #[cfg(windows)]
    let dark = monochrome && crate::windows_theme::is_dark();
    #[cfg(not(windows))]
    let dark = false; // macOS tints the black template itself.
    icons().for_state(count, monochrome, dark)
}

#[cfg(windows)]
fn watch_taskbar_theme(app: &AppHandle) {
    let handle = app.clone();
    let result = crate::windows_theme::watch(move || {
        let app = handle.clone();
        // Run on the UI thread and read the latest count there, so a queued theme change
        // cannot overwrite a more recent unread update or a switch back to colour.
        if let Err(error) = handle.run_on_main_thread(move || {
            if uses_monochrome(&app) {
                let count = app.state::<AppState>().unread.lock().unwrap().unwrap_or(0);
                if let Err(error) = update_icon(&app, count) {
                    eprintln!("Couldn't update the tray icon for the Windows theme: {error}");
                }
            }
        }) {
            eprintln!("Couldn't dispatch the Windows theme change: {error}");
        }
    });
    if let Err(error) = result {
        eprintln!("Couldn't watch the Windows taskbar theme: {error}");
    }
}

/// Adds or removes the login item, which starts the app in the tray. The check mark shows
/// what the system has afterwards, also if the change failed.
fn toggle_autostart(app: &AppHandle, item: &CheckMenuItem<tauri::Wry>) {
    let autostart = app.autolaunch();
    let _ = if starts_at_login(app) {
        autostart.disable()
    } else {
        autostart.enable()
    };
    let _ = item.set_checked(starts_at_login(app));
}

/// Shows the number of inbox entries: in the tooltip, as a dot on the tray icon and on the
/// app's icon (a count where the platform has badges, a dot on the Windows taskbar). 0 also
/// stands for "not shown", as the user can turn the count off.
pub fn set_unread(app: &AppHandle, count: u32) -> tauri::Result<()> {
    let changed = app
        .state::<AppState>()
        .unread
        .lock()
        .unwrap()
        .replace(count)
        != Some(count);
    if !changed {
        return Ok(());
    }
    // The tooltip, with the connection state, and the icon, colour or monochrome.
    refresh(app)?;
    update_icon(app, count)?;
    if let Some(window) = app.get_webview_window(window::MAIN) {
        #[cfg(not(windows))]
        window.set_badge_count((count > 0).then_some(i64::from(count)))?;
        #[cfg(windows)]
        window.set_overlay_icon((count > 0).then(|| icons().overlay.clone()))?;
    }
    Ok(())
}

/// Shows the state of the connection and the inbox count in the tooltip and the menu.
pub fn refresh(app: &AppHandle) -> tauri::Result<()> {
    let (count, status) = {
        let state = app.state::<AppState>();
        let count = state.unread.lock().unwrap().unwrap_or(0);
        let status = state.connection.lock().unwrap().status();
        (count, status)
    };
    if let Some(item) = app.try_state::<StatusItem>() {
        item.0.set_text(status.describe())?;
    }
    if let Some(tray) = app.tray_by_id(TRAY) {
        tray.set_tooltip(Some(tooltip(count, status)))?;
    }
    Ok(())
}

/// The inbox count while connected; otherwise why notifications don't arrive, as the count
/// may be out of date.
fn tooltip(count: u32, status: Status) -> String {
    match (status, count) {
        (Status::Connected, 0) => "Releases".to_owned(),
        (Status::Connected, 1) => "Releases · 1 entry in the inbox".to_owned(),
        (Status::Connected, count) => format!("Releases · {count} entries in the inbox"),
        (status, _) => format!("Releases · {}", status.describe()),
    }
}

struct Icons {
    plain: Image<'static>,
    /// With a dot, for an inbox with entries.
    dotted: Image<'static>,
    monochrome: Image<'static>,
    monochrome_dotted: Image<'static>,
    monochrome_white: Image<'static>,
    monochrome_white_dotted: Image<'static>,
    /// The dot alone, on the taskbar button.
    #[cfg(windows)]
    overlay: Image<'static>,
}

impl Icons {
    fn for_state(&self, count: u32, monochrome: bool, dark: bool) -> &Image<'static> {
        match (monochrome, count > 0, dark) {
            (false, false, _) => &self.plain,
            (false, true, _) => &self.dotted,
            (true, false, false) => &self.monochrome,
            (true, true, false) => &self.monochrome_dotted,
            (true, false, true) => &self.monochrome_white,
            (true, true, true) => &self.monochrome_white_dotted,
        }
    }
}

/// The tray's icons, drawn once.
fn icons() -> &'static Icons {
    static ICONS: OnceLock<Icons> = OnceLock::new();
    ICONS.get_or_init(|| {
        let plain = Image::from_bytes(ICON).expect("the bundled icon is a valid PNG");
        let dotted = with_dot(&plain, false);
        let monochrome =
            Image::from_bytes(TEMPLATE_ICON).expect("the template icon is a valid PNG");
        let monochrome_dotted = with_dot(&monochrome, true);
        let monochrome_white = white_template(&monochrome);
        let monochrome_white_dotted = white_template(&monochrome_dotted);
        Icons {
            plain,
            dotted,
            monochrome,
            monochrome_dotted,
            monochrome_white,
            monochrome_white_dotted,
            #[cfg(windows)]
            overlay: dot(32),
        }
    })
}

/// Windows uses the bitmap's colour; retain the template's anti-aliasing and cut-out ring.
fn white_template(icon: &Image<'_>) -> Image<'static> {
    let mut rgba = icon.rgba().to_vec();
    for pixel in rgba.as_chunks_mut::<4>().0 {
        pixel[..3].fill(255);
    }
    Image::new_owned(rgba, icon.width(), icon.height())
}

const RED: [u8; 3] = [0xe5, 0x48, 0x4d];

/// The icon with an unread dot in its lower right corner.
fn with_dot(icon: &Image<'_>, monochrome: bool) -> Image<'static> {
    let (width, height) = (icon.width(), icon.height());
    let mut rgba = icon.rgba().to_vec();
    let (w, h) = (width as f32, height as f32);
    paint_dot(
        &mut rgba,
        width,
        height,
        (w * 0.72, h * 0.72, w.min(h) * 0.26),
        monochrome,
    );
    Image::new_owned(rgba, width, height)
}

/// A red dot filling an icon of `size`, for the taskbar overlay on Windows.
#[cfg(windows)]
fn dot(size: u32) -> Image<'static> {
    let mut rgba = vec![0; (size * size * 4) as usize];
    let centre = size as f32 / 2.0;
    paint_dot(&mut rgba, size, size, (centre, centre, centre), false);
    Image::new_owned(rgba, size, size)
}

/// A filled circle with a contrasting ring: white for colour, transparent for a template.
fn paint_dot(rgba: &mut [u8], width: u32, height: u32, circle: (f32, f32, f32), monochrome: bool) {
    let (cx, cy, radius) = circle;
    let ring = (radius * 0.18).max(1.0);
    for y in 0..height {
        for x in 0..width {
            let dx = x as f32 + 0.5 - cx;
            let dy = y as f32 + 0.5 - cy;
            let distance = (dx * dx + dy * dy).sqrt();
            let coverage = (radius - distance + 0.5).clamp(0.0, 1.0);
            if coverage == 0.0 {
                continue;
            }
            let colour = if distance > radius - ring {
                [0xff; 3]
            } else {
                RED
            };
            let start = ((y * width + x) * 4) as usize;
            let pixel = &mut rgba[start..start + 4];
            // "Over" with straight alpha: transparent pixels don't darken the edge.
            let below = f32::from(pixel[3]) / 255.0;
            if monochrome {
                // A template uses only alpha. Cut a transparent ring around the solid dot
                // so macOS can tint both the rocket and indicator in either appearance.
                let alpha = if distance > radius - ring {
                    below * (1.0 - coverage)
                } else {
                    coverage + below * (1.0 - coverage)
                };
                pixel[..3].fill(0);
                pixel[3] = (alpha * 255.0).round() as u8;
                continue;
            }
            let alpha = coverage + below * (1.0 - coverage);
            for (value, target) in pixel[..3].iter_mut().zip(colour) {
                let mixed =
                    f32::from(target) * coverage + f32::from(*value) * below * (1.0 - coverage);
                *value = (mixed / alpha).round() as u8;
            }
            pixel[3] = (alpha * 255.0).round() as u8;
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn paints_the_dot_in_the_corner_only() {
        let icon = Image::new_owned(vec![0; 16 * 16 * 4], 16, 16);
        let dotted = with_dot(&icon, false);
        let alpha = |x: u32, y: u32| dotted.rgba()[((y * 16 + x) * 4 + 3) as usize];
        assert_eq!(alpha(1, 1), 0);
        assert_eq!(alpha(12, 12), 255);
    }

    #[test]
    fn keeps_the_colour_of_the_edge_over_transparency() {
        let icon = Image::new_owned(vec![0; 64 * 64 * 4], 64, 64);
        let dotted = with_dot(&icon, false);
        let edge = dotted
            .rgba()
            .chunks(4)
            .find(|pixel| pixel[3] > 0 && pixel[3] < 255)
            .unwrap();
        assert_eq!(&edge[..3], [0xff; 3]);
    }

    #[test]
    fn counts_entries_in_the_tooltip() {
        assert_eq!(tooltip(0, Status::Connected), "Releases");
        assert_eq!(
            tooltip(1, Status::Connected),
            "Releases · 1 entry in the inbox"
        );
        assert_eq!(
            tooltip(7, Status::Connected),
            "Releases · 7 entries in the inbox"
        );
    }

    #[test]
    fn says_why_notifications_dont_arrive_instead() {
        assert_eq!(tooltip(7, Status::Disconnected), "Releases · Not connected");
        assert_eq!(
            tooltip(0, Status::SignedOut),
            "Releases · Sign in to get notifications"
        );
    }

    #[test]
    fn template_dot_has_a_transparent_ring() {
        let icon = Image::new_owned([0, 0, 0, 255].repeat(64 * 64), 64, 64);
        let dotted = with_dot(&icon, true);
        let pixel = |x: usize, y: usize| &dotted.rgba()[(y * 64 + x) * 4..][..4];
        assert_eq!(pixel(1, 1), [0, 0, 0, 255]);
        assert_eq!(pixel(46, 46), [0, 0, 0, 255]);
        assert_eq!(pixel(61, 46), [0, 0, 0, 0]);
    }

    #[test]
    fn template_assets_keep_transparency_and_the_unread_indicator() {
        let icons = icons();
        for count in [0, 1] {
            let icon = icons.for_state(count, true, false);
            assert!(
                icon.rgba()
                    .as_chunks::<4>()
                    .0
                    .iter()
                    .all(|pixel| pixel[..3] == [0; 3])
            );
            assert_eq!(icon.rgba()[3], 0);
            assert!(
                icon.rgba()
                    .as_chunks::<4>()
                    .0
                    .iter()
                    .any(|pixel| pixel[3] == 255)
            );
        }
        assert_ne!(
            icons.for_state(0, true, false).rgba(),
            icons.for_state(1, true, false).rgba()
        );
        assert_ne!(
            icons.for_state(0, false, false).rgba(),
            icons.for_state(0, true, false).rgba()
        );
    }

    #[test]
    fn windows_theme_changes_colour_without_changing_the_unread_mask() {
        let icons = icons();
        for count in [0, 1, 37] {
            let light = icons.for_state(count, true, false);
            let dark = icons.for_state(count, true, true);
            assert_eq!(
                (light.width(), light.height()),
                (dark.width(), dark.height())
            );
            for (black, white) in light
                .rgba()
                .as_chunks::<4>()
                .0
                .iter()
                .zip(dark.rgba().as_chunks::<4>().0)
            {
                assert_eq!(&black[..3], &[0; 3]);
                assert_eq!(&white[..3], &[255; 3]);
                assert_eq!(black[3], white[3]);
            }
            assert_eq!(
                icons.for_state(count, false, false).rgba(),
                icons.for_state(count, false, true).rgba(),
            );
        }
        assert_ne!(
            icons.for_state(0, true, true).rgba(),
            icons.for_state(37, true, true).rgba(),
        );
    }
}
