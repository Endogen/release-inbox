//! Observe minimization of the main window. Each desktop reports this transition differently.

use tauri::WebviewWindow;

#[cfg(windows)]
pub fn observe(window: &WebviewWindow, minimized: impl Fn() + Send + 'static) -> tauri::Result<()> {
    // Windows delivers WM_SIZE for minimization. Check the native iconic state, since
    // ordinary resizes also produce this event.
    let main = window.clone();
    window.on_window_event(move |event| {
        if matches!(event, tauri::WindowEvent::Resized(_)) && main.is_minimized().unwrap_or(false) {
            minimized();
        }
    });
    Ok(())
}

#[cfg(target_os = "linux")]
pub fn observe(window: &WebviewWindow, minimized: impl Fn() + 'static) -> tauri::Result<()> {
    use gtk::{gdk::WindowState, glib::Propagation, prelude::WidgetExt};

    window
        .gtk_window()?
        .connect_window_state_event(move |_, event| {
            if event.changed_mask().contains(WindowState::ICONIFIED)
                && event.new_window_state().contains(WindowState::ICONIFIED)
            {
                minimized();
            }
            Propagation::Proceed
        });
    Ok(())
}

#[cfg(target_os = "macos")]
pub fn observe(
    window: &WebviewWindow,
    minimized: impl Fn() + Send + Sync + 'static,
) -> tauri::Result<()> {
    use block2::RcBlock;
    use dispatch2::MainThreadBound;
    use objc2::{MainThreadMarker, runtime::AnyObject};
    use objc2_app_kit::NSWindowDidMiniaturizeNotification;
    use objc2_foundation::NSNotificationCenter;

    let main_thread = MainThreadMarker::new().expect("windows are created on the main thread");
    let center = NSNotificationCenter::defaultCenter();
    let callback = RcBlock::new(move |_| minimized());
    // The live window supplies the NSWindow pointer. AppKit posts this notification
    // on the main thread after miniaturization has completed.
    let token = unsafe {
        center.addObserverForName_object_queue_usingBlock(
            Some(NSWindowDidMiniaturizeNotification),
            Some(&*window.ns_window()?.cast::<AnyObject>()),
            None,
            &callback,
        )
    };
    let token = MainThreadBound::new(token, main_thread);
    window.on_window_event(move |event| {
        if matches!(event, tauri::WindowEvent::Destroyed) {
            // The same notification center issued this observer token.
            token.get_on_main(|token| unsafe {
                NSNotificationCenter::defaultCenter().removeObserver(token.as_ref());
            });
        }
    });
    Ok(())
}
