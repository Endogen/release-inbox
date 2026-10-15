//! The shell's theme is independent of the app theme (Windows Settings → Colours → Custom).
//! Watch its registry setting, since Tauri's ThemeChanged event follows the app theme only.

use std::io;
use std::os::windows::io::{AsRawHandle, FromRawHandle, OwnedHandle};

use windows_registry::CURRENT_USER;
use windows_sys::Win32::Foundation::{ERROR_SUCCESS, WAIT_OBJECT_0};
use windows_sys::Win32::System::Registry::{
    REG_NOTIFY_CHANGE_LAST_SET, REG_NOTIFY_CHANGE_NAME, RegNotifyChangeKeyValue,
};
use windows_sys::Win32::System::Threading::{CreateEventW, INFINITE, WaitForSingleObject};

const THEMES: &str = r"Software\Microsoft\Windows\CurrentVersion\Themes";
const PERSONALIZE: &str = r"Software\Microsoft\Windows\CurrentVersion\Themes\Personalize";

pub fn is_dark() -> bool {
    // Older Windows versions without this value use a dark taskbar.
    CURRENT_USER
        .open(PERSONALIZE)
        .and_then(|key| key.get_u32("SystemUsesLightTheme"))
        .unwrap_or(0)
        == 0
}

/// A sleeping, read-only registry watcher, also active while the app is hidden in the tray.
/// It lives for the process lifetime; Windows releases its wait and handles on process exit.
pub fn watch(on_change: impl FnMut() + Send + 'static) -> io::Result<()> {
    std::thread::Builder::new()
        .name("taskbar-theme".into())
        .spawn(move || {
            if let Err(error) = watch_changes(on_change) {
                eprintln!("Couldn't watch the Windows taskbar theme: {error}");
            }
        })?;
    Ok(())
}

fn watch_changes(mut on_change: impl FnMut()) -> io::Result<()> {
    // Watch the parent as well, so creating/removing Personalize or its value is noticed.
    let key = CURRENT_USER
        .open(THEMES)
        .map_err(|error| io::Error::other(error.to_string()))?;
    // SAFETY: Null security/name pointers select the defaults. This creates an unnamed,
    // auto-reset event which is owned below and stays alive for every notification/wait.
    let raw_event = unsafe { CreateEventW(std::ptr::null(), 0, 0, std::ptr::null()) };
    if raw_event.is_null() {
        return Err(io::Error::last_os_error());
    }
    // SAFETY: CreateEventW returned a new, valid handle; ownership is transferred once.
    let event = unsafe { OwnedHandle::from_raw_handle(raw_event) };
    let mut previous = None;
    loop {
        // Arm before reading to avoid missing a change between the read and the wait.
        // SAFETY: The key has KEY_READ (including KEY_NOTIFY); both handles remain alive.
        let result = unsafe {
            RegNotifyChangeKeyValue(
                key.as_raw(),
                1,
                REG_NOTIFY_CHANGE_LAST_SET | REG_NOTIFY_CHANGE_NAME,
                event.as_raw_handle(),
                1,
            )
        };
        if result != ERROR_SUCCESS {
            return Err(io::Error::from_raw_os_error(result as i32));
        }
        let dark = is_dark();
        if previous != Some(dark) {
            previous = Some(dark);
            on_change();
        }
        // SAFETY: The owned event is valid and remains alive until this wait returns.
        if unsafe { WaitForSingleObject(event.as_raw_handle(), INFINITE) } != WAIT_OBJECT_0 {
            return Err(io::Error::last_os_error());
        }
    }
}
