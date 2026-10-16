//! Whether the app can deliver notifications. They only arrive while the server's web app is
//! loaded, signed in and connected to its event stream, so the web app reports its state;
//! pages that can't, such as the setup page or the web view's error page, count as not
//! connected. The tray shows the state, and a problem that lasts while the window is hidden
//! is told once in a notification.

use std::thread;
use std::time::Duration;

use serde::Deserialize;
use tauri::{AppHandle, Manager, Url};
use tauri_plugin_notification::NotificationExt;

use crate::{AppState, tray, window};

/// How long a loaded page has to report, and how long a problem lasts before the user is
/// told: a server that restarts or a network that drops for a moment is no news.
const SETTLE: Duration = Duration::from_secs(30);

#[derive(Debug, Default, Clone, Copy, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum Status {
    /// A page of the server is loading and hasn't reported yet.
    #[default]
    #[serde(skip_deserializing)]
    Connecting,
    /// Signed in and connected to the event stream: notifications arrive.
    Connected,
    /// The server's app shows its sign-in page.
    SignedOut,
    /// No connection to the server's event stream, or no page of the server at all.
    Disconnected,
}

impl Status {
    /// What the tray says about it.
    pub fn describe(self) -> &'static str {
        match self {
            Status::Connecting => "Connecting…",
            Status::Connected => "Connected",
            Status::SignedOut => "Sign in to get notifications",
            Status::Disconnected => "Not connected",
        }
    }

    fn is_problem(self) -> bool {
        matches!(self, Status::SignedOut | Status::Disconnected)
    }
}

/// The state and what is needed to tell about problems once.
#[derive(Debug, Default)]
pub struct Connection {
    status: Status,
    /// Counts the changes, so a check scheduled for an earlier one does nothing.
    changes: u64,
    /// Whether the user was told about the problem since the app was last connected.
    told: bool,
}

/// What a check after [`SETTLE`] found.
#[derive(Debug, PartialEq, Eq)]
struct Settled {
    /// The page didn't report: it now counts as not connected.
    timed_out: bool,
    /// The problem to tell the user about.
    tell: Option<Status>,
}

impl Connection {
    pub fn status(&self) -> Status {
        self.status
    }

    /// Records `status`; returns the number of the change if it needs a check later. A page
    /// that starts loading always does, even if the one before was loading too.
    fn set(&mut self, status: Status) -> Option<u64> {
        if status == self.status && status != Status::Connecting {
            return None;
        }
        self.status = status;
        self.changes += 1;
        if status == Status::Connected {
            self.told = false;
            return None;
        }
        Some(self.changes)
    }

    /// The check for `change` after [`SETTLE`], while the window is `hidden` or not.
    fn settle(&mut self, change: u64, hidden: bool) -> Settled {
        let mut settled = Settled {
            timed_out: false,
            tell: None,
        };
        if change != self.changes {
            return settled;
        }
        if self.status == Status::Connecting {
            self.status = Status::Disconnected;
            settled.timed_out = true;
        }
        if hidden && !self.told && self.status.is_problem() {
            self.told = true;
            settled.tell = Some(self.status);
        }
        settled
    }
}

/// Records the state the server's app reported, or what the app knows itself.
pub fn set(app: &AppHandle, status: Status) -> tauri::Result<()> {
    let change = app
        .state::<AppState>()
        .connection
        .lock()
        .unwrap()
        .set(status);
    if let Some(change) = change {
        check_later(app, change);
    }
    tray::refresh(app)
}

/// A page starts loading: the server's app reports soon, any other page can't.
pub fn page_loading(app: &AppHandle, url: &Url) -> tauri::Result<()> {
    let on_server =
        window::current_server(app).is_some_and(|server| server.origin() == url.origin());
    set(
        app,
        if on_server {
            Status::Connecting
        } else {
            Status::Disconnected
        },
    )
}

fn check_later(app: &AppHandle, change: u64) {
    let app = app.clone();
    thread::spawn(move || {
        thread::sleep(SETTLE);
        let hidden = window::is_hidden(&app);
        let settled = app
            .state::<AppState>()
            .connection
            .lock()
            .unwrap()
            .settle(change, hidden);
        if settled.timed_out {
            let _ = tray::refresh(&app);
        }
        if let Some(problem) = settled.tell {
            tell(&app, problem);
        }
    });
}

/// A click on it opens the window, which shows what is wrong.
fn tell(app: &AppHandle, problem: Status) {
    let body = match problem {
        Status::SignedOut => "Your session ended. Open Releases and sign in again.",
        _ => {
            "It isn't connected to your server. Open Releases to see why, or choose Reload in the tray menu."
        }
    };
    let _ = app
        .notification()
        .builder()
        .title("Releases can't notify you")
        .body(body)
        .show();
}

#[cfg(test)]
mod tests {
    use super::*;

    fn connection(status: Status) -> (Connection, u64) {
        let mut connection = Connection::default();
        let change = connection.set(status).unwrap_or(connection.changes);
        (connection, change)
    }

    #[test]
    fn reads_the_reports_of_the_web_app() {
        let status: Status = serde_json::from_str(r#""signed-out""#).unwrap();
        assert_eq!(status, Status::SignedOut);
        assert!(serde_json::from_str::<Status>(r#""connecting""#).is_err());
    }

    #[test]
    fn counts_a_page_that_never_reports_as_not_connected() {
        let (mut connection, change) = connection(Status::Connecting);
        let settled = connection.settle(change, false);
        assert!(settled.timed_out);
        assert_eq!(settled.tell, None);
        assert_eq!(connection.status(), Status::Disconnected);
    }

    #[test]
    fn ignores_checks_of_earlier_changes() {
        let (mut connection, change) = connection(Status::Connecting);
        connection.set(Status::Connected);
        let settled = connection.settle(change, true);
        assert!(!settled.timed_out);
        assert_eq!(settled.tell, None);
        assert_eq!(connection.status(), Status::Connected);
    }

    #[test]
    fn tells_about_a_problem_once_while_hidden() {
        let (mut connection, change) = connection(Status::Disconnected);
        assert_eq!(
            connection.settle(change, true).tell,
            Some(Status::Disconnected)
        );

        let change = connection.set(Status::SignedOut).unwrap();
        assert_eq!(connection.settle(change, true).tell, None);
        let change = connection.set(Status::Connecting).unwrap();
        assert_eq!(connection.settle(change, true).tell, None);
    }

    #[test]
    fn tells_nothing_while_the_window_is_shown() {
        let (mut connection, change) = connection(Status::SignedOut);
        assert_eq!(connection.settle(change, false).tell, None);
    }

    #[test]
    fn tells_again_after_it_was_connected() {
        let (mut connection, change) = connection(Status::Disconnected);
        assert_eq!(
            connection.settle(change, true).tell,
            Some(Status::Disconnected)
        );

        assert_eq!(connection.set(Status::Connected), None);
        let change = connection.set(Status::Disconnected).unwrap();
        assert_eq!(
            connection.settle(change, true).tell,
            Some(Status::Disconnected)
        );
    }

    #[test]
    fn needs_no_check_for_a_repeated_report() {
        let (mut connection, _) = connection(Status::Disconnected);
        assert_eq!(connection.set(Status::Disconnected), None);
        assert!(connection.set(Status::Connecting).is_some());
        assert!(connection.set(Status::Connecting).is_some());
    }
}
