//! The buttons on release notifications. The desktop doesn't call the server itself: a click
//! asks the web app to act with its signed-in session, through [`ACTION_EVENT`].

use std::collections::HashMap;

use serde::Serialize;
use serde_json::Value;
use tauri_plugin_notification::{Action, ActionType};

/// Asks the web app to act on the releases of a notification.
pub const ACTION_EVENT: &str = "desktop://action";

/// The notification's `extra`s that hold the releases it is about and, if they all belong to
/// one, their repository.
pub const RELEASE_IDS_EXTRA: &str = "release_ids";
pub const REPOSITORY_ID_EXTRA: &str = "repository_id";

const MARK_READ: &str = "mark-read";
const SNOOZE: &str = "snooze";
const MUTE: &str = "mute";

/// Releases of one repository: all actions apply.
const REPOSITORY_RELEASES: &str = "repository-releases";
/// Releases of several repositories, which can't be muted together.
const RELEASES: &str = "releases";

/// The action types the notifications refer to; registered once at startup.
pub fn action_types() -> Vec<ActionType> {
    let mark_read = || Action::builder(MARK_READ, "Mark as read").build();
    let snooze = || Action::builder(SNOOZE, "Snooze until tomorrow").build();
    vec![
        ActionType::builder(REPOSITORY_RELEASES)
            .actions(vec![
                mark_read(),
                snooze(),
                Action::builder(MUTE, "Mute repository").build(),
            ])
            .build(),
        ActionType::builder(RELEASES)
            .actions(vec![mark_read(), snooze()])
            .build(),
    ]
}

/// The action type of a notification about `release_ids`; `None` if it isn't about releases.
pub fn action_type_id(release_ids: &[i64], repository_id: Option<i64>) -> Option<&'static str> {
    match (release_ids.is_empty(), repository_id) {
        (true, _) => None,
        (false, Some(_)) => Some(REPOSITORY_RELEASES),
        (false, None) => Some(RELEASES),
    }
}

/// The payload of an [`ACTION_EVENT`].
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct ActionEvent {
    action: &'static str,
    release_ids: Vec<i64>,
    repository_id: Option<i64>,
    /// The notification's title, such as the repository's name, to describe what was done.
    title: Option<String>,
}

/// What the web app should do for a click on the button `action_id` of a notification with
/// `extra`; `None` for anything that isn't one of the buttons above.
pub fn event(
    action_id: &str,
    extra: &HashMap<String, Value>,
    title: Option<&str>,
) -> Option<ActionEvent> {
    let action = [MARK_READ, SNOOZE, MUTE]
        .into_iter()
        .find(|action| *action == action_id)?;
    let release_ids: Vec<i64> = extra
        .get(RELEASE_IDS_EXTRA)
        .and_then(|ids| serde_json::from_value(ids.clone()).ok())
        .unwrap_or_default();
    let repository_id = extra.get(REPOSITORY_ID_EXTRA).and_then(Value::as_i64);
    let applies = match action {
        MUTE => repository_id.is_some(),
        _ => !release_ids.is_empty(),
    };
    applies.then(|| ActionEvent {
        action,
        release_ids,
        repository_id,
        title: title.map(str::to_owned),
    })
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::*;

    fn extra(value: Value) -> HashMap<String, Value> {
        serde_json::from_value(value).unwrap()
    }

    fn action_ids(type_id: &str) -> Vec<String> {
        action_types()
            .into_iter()
            .find(|action_type| action_type.id() == type_id)
            .unwrap()
            .actions()
            .iter()
            .map(|action| action.id().to_owned())
            .collect()
    }

    #[test]
    fn offers_muting_only_for_releases_of_one_repository() {
        assert_eq!(action_type_id(&[], Some(3)), None);
        let one = action_type_id(&[1, 2], Some(3)).unwrap();
        assert_eq!(action_ids(one), [MARK_READ, SNOOZE, MUTE]);
        let several = action_type_id(&[1, 2], None).unwrap();
        assert_eq!(action_ids(several), [MARK_READ, SNOOZE]);
    }

    #[test]
    fn passes_the_releases_of_a_clicked_button_on() {
        let about = extra(json!({ "url": "/inbox", "release_ids": [1, 2], "repository_id": 3 }));
        assert_eq!(
            event(SNOOZE, &about, Some("acme/app")),
            Some(ActionEvent {
                action: SNOOZE,
                release_ids: vec![1, 2],
                repository_id: Some(3),
                title: Some("acme/app".into()),
            })
        );
        assert_eq!(
            serde_json::to_value(event(MUTE, &about, None)).unwrap(),
            json!({ "action": "mute", "release_ids": [1, 2], "repository_id": 3, "title": null })
        );
    }

    #[test]
    fn ignores_other_actions_and_buttons_without_their_releases() {
        let mixed = extra(json!({ "release_ids": [1, 2], "repository_id": null }));
        assert_eq!(event("tap", &mixed, None), None);
        assert_eq!(event(MUTE, &mixed, None), None);
        assert!(event(MARK_READ, &mixed, None).is_some());
        assert_eq!(
            event(MARK_READ, &extra(json!({ "url": "/inbox" })), None),
            None
        );
    }
}
