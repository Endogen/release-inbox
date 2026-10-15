//! The tray icon: opens the window, shows whether the inbox has entries and offers the app's
//! menu. It stays after the window is closed, until the user quits.

use tauri::image::Image;
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Emitter, Manager};

use crate::window;

const TRAY: &str = "tray";
const ICON: &[u8] = include_bytes!("../icons/64x64.png");

/// Asks the web app to sync; it does the work with its signed-in session.
pub const SYNC_EVENT: &str = "desktop://sync";

pub fn create(app: &AppHandle) -> tauri::Result<()> {
    let menu = Menu::with_items(
        app,
        &[
            &MenuItem::with_id(app, "open", "Open Releases", true, None::<&str>)?,
            &MenuItem::with_id(app, "sync", "Sync now", true, None::<&str>)?,
            &PredefinedMenuItem::separator(app)?,
            &MenuItem::with_id(app, "server", "Change server…", true, None::<&str>)?,
            &PredefinedMenuItem::separator(app)?,
            &MenuItem::with_id(app, "quit", "Quit Releases", true, None::<&str>)?,
        ],
    )?;
    TrayIconBuilder::with_id(TRAY)
        .icon(Image::from_bytes(ICON)?)
        .tooltip("Releases")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id().as_ref() {
            "open" => window::show(app),
            "sync" => {
                let _ = app.emit_to(window::MAIN, SYNC_EVENT, ());
            }
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

/// Shows the number of inbox entries: in the tooltip, as a dot on the tray icon and on the
/// app's icon (a count where the platform has badges, a dot on the Windows taskbar).
pub fn set_unread(app: &AppHandle, count: u32) -> tauri::Result<()> {
    if let Some(tray) = app.tray_by_id(TRAY) {
        tray.set_tooltip(Some(tooltip(count)))?;
        let icon = Image::from_bytes(ICON)?;
        tray.set_icon(Some(if count > 0 { with_dot(&icon) } else { icon }))?;
    }
    if let Some(window) = app.get_webview_window(window::MAIN) {
        #[cfg(not(windows))]
        window.set_badge_count((count > 0).then_some(i64::from(count)))?;
        #[cfg(windows)]
        window.set_overlay_icon((count > 0).then(|| dot(32)))?;
    }
    Ok(())
}

fn tooltip(count: u32) -> String {
    match count {
        0 => "Releases · inbox zero".to_owned(),
        1 => "Releases · 1 entry in the inbox".to_owned(),
        count => format!("Releases · {count} entries in the inbox"),
    }
}

const RED: [u8; 3] = [0xe5, 0x48, 0x4d];

/// The icon with a red dot in its lower right corner.
fn with_dot(icon: &Image<'_>) -> Image<'static> {
    let (width, height) = (icon.width(), icon.height());
    let mut rgba = icon.rgba().to_vec();
    let size = width as f32;
    paint_dot(
        &mut rgba,
        width,
        height,
        size * 0.72,
        height as f32 * 0.72,
        size * 0.26,
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

/// A filled circle with a white ring, anti-aliased at its edge.
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
            for (value, target) in pixel.iter_mut().zip(colour) {
                *value =
                    (f32::from(target) * coverage + f32::from(*value) * (1.0 - coverage)) as u8;
            }
            pixel[3] = pixel[3].max((coverage * 255.0) as u8);
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
    fn counts_entries_in_the_tooltip() {
        assert_eq!(tooltip(0), "Releases · inbox zero");
        assert_eq!(tooltip(1), "Releases · 1 entry in the inbox");
        assert_eq!(tooltip(7), "Releases · 7 entries in the inbox");
    }
}
