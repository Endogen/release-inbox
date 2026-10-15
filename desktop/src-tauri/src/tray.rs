//! The tray icon: opens the window, shows whether the inbox has entries and offers the app's
//! menu. It stays after the window is closed, until the user quits.

use std::sync::OnceLock;

use tauri::image::Image;
use tauri::menu::{CheckMenuItem, Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_autostart::ManagerExt;

use crate::{AppState, window};

const TRAY: &str = "tray";
const ICON: &[u8] = include_bytes!("../icons/64x64.png");

/// Asks the web app to sync; it does the work with its signed-in session.
const SYNC_EVENT: &str = "desktop://sync";

pub fn create(app: &AppHandle) -> tauri::Result<()> {
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
    TrayIconBuilder::with_id(TRAY)
        .icon(icons().plain.clone())
        .tooltip(tooltip(0))
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
    Ok(())
}

fn starts_at_login(app: &AppHandle) -> bool {
    app.autolaunch().is_enabled().unwrap_or(false)
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
    if let Some(tray) = app.tray_by_id(TRAY) {
        tray.set_tooltip(Some(tooltip(count)))?;
        let icons = icons();
        let icon = if count > 0 {
            &icons.dotted
        } else {
            &icons.plain
        };
        tray.set_icon(Some(icon.clone()))?;
    }
    if let Some(window) = app.get_webview_window(window::MAIN) {
        #[cfg(not(windows))]
        window.set_badge_count((count > 0).then_some(i64::from(count)))?;
        #[cfg(windows)]
        window.set_overlay_icon((count > 0).then(|| icons().overlay.clone()))?;
    }
    Ok(())
}

fn tooltip(count: u32) -> String {
    match count {
        0 => "Releases".to_owned(),
        1 => "Releases · 1 entry in the inbox".to_owned(),
        count => format!("Releases · {count} entries in the inbox"),
    }
}

struct Icons {
    plain: Image<'static>,
    /// With a dot, for an inbox with entries.
    dotted: Image<'static>,
    /// The dot alone, on the taskbar button.
    #[cfg(windows)]
    overlay: Image<'static>,
}

/// The tray's icons, drawn once.
fn icons() -> &'static Icons {
    static ICONS: OnceLock<Icons> = OnceLock::new();
    ICONS.get_or_init(|| {
        let plain = Image::from_bytes(ICON).expect("the bundled icon is a valid PNG");
        let dotted = with_dot(&plain);
        Icons {
            plain,
            dotted,
            #[cfg(windows)]
            overlay: dot(32),
        }
    })
}

const RED: [u8; 3] = [0xe5, 0x48, 0x4d];

/// The icon with a red dot in its lower right corner.
fn with_dot(icon: &Image<'_>) -> Image<'static> {
    let (width, height) = (icon.width(), icon.height());
    let mut rgba = icon.rgba().to_vec();
    let (w, h) = (width as f32, height as f32);
    paint_dot(
        &mut rgba,
        width,
        height,
        w * 0.72,
        h * 0.72,
        w.min(h) * 0.26,
    );
    Image::new_owned(rgba, width, height)
}

/// A red dot filling an icon of `size`, for the taskbar overlay on Windows.
#[cfg(windows)]
fn dot(size: u32) -> Image<'static> {
    let mut rgba = vec![0; (size * size * 4) as usize];
    let centre = size as f32 / 2.0;
    paint_dot(&mut rgba, size, size, centre, centre, centre);
    Image::new_owned(rgba, size, size)
}

/// A filled circle with a white ring, drawn over the image and anti-aliased at its edge.
fn paint_dot(rgba: &mut [u8], width: u32, height: u32, cx: f32, cy: f32, radius: f32) {
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
        let dotted = with_dot(&icon);
        let alpha = |x: u32, y: u32| dotted.rgba()[((y * 16 + x) * 4 + 3) as usize];
        assert_eq!(alpha(1, 1), 0);
        assert_eq!(alpha(12, 12), 255);
    }

    #[test]
    fn keeps_the_colour_of_the_edge_over_transparency() {
        let icon = Image::new_owned(vec![0; 64 * 64 * 4], 64, 64);
        let dotted = with_dot(&icon);
        let edge = dotted
            .rgba()
            .chunks(4)
            .find(|pixel| pixel[3] > 0 && pixel[3] < 255)
            .unwrap();
        assert_eq!(&edge[..3], [0xff; 3]);
    }

    #[test]
    fn counts_entries_in_the_tooltip() {
        assert_eq!(tooltip(0), "Releases");
        assert_eq!(tooltip(1), "Releases · 1 entry in the inbox");
        assert_eq!(tooltip(7), "Releases · 7 entries in the inbox");
    }
}
