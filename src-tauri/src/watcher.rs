use crate::markdown::MarkdownState;
use crate::markdown::build_render_cache_key;
use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};
use std::thread;
use std::time::Duration;
use tauri::Emitter;

const MARKDOWN_UPDATED_EVENT: &str = "markdown-updated";
const MARKDOWN_WATCH_ERROR_EVENT: &str = "markdown-watch-error";
const POLL_INTERVAL_MS: u64 = 200;

#[derive(Clone, Serialize)]
struct MarkdownUpdatedEvent {
    content: String,
    path: String,
    render_cache_key: String,
}

#[derive(Clone, Serialize)]
struct MarkdownWatchErrorEvent {
    message: String,
    path: Option<String>,
}

pub fn start(app_handle: tauri::AppHandle, state: MarkdownState) {
    thread::spawn(move || {
        let mut watched_path: Option<PathBuf> = None;
        let mut last_error: Option<String> = None;

        loop {
            let current_path = state.0.path.lock().unwrap().clone();

            if current_path != watched_path {
                watched_path = current_path.clone();
                last_error = None;
            }

            if let Some(target_path) = current_path {
                match fs::read_to_string(&target_path) {
                    Ok(updated_content) => {
                        last_error = None;
                        sync_markdown_content(&app_handle, &state, &target_path, updated_content);
                    }
                    Err(error) => {
                        let message = format!("File could not be read: {error}");
                        if last_error.as_deref() != Some(message.as_str()) {
                            emit_watch_error(&app_handle, Some(&target_path), &message);
                            last_error = Some(message);
                        }
                    }
                }
            }

            thread::sleep(Duration::from_millis(POLL_INTERVAL_MS));
        }
    });
}

fn sync_markdown_content(
    app_handle: &tauri::AppHandle,
    state: &MarkdownState,
    target_path: &Path,
    updated_content: String,
) {
    let mut current_content = state.0.content.lock().unwrap();
    if *current_content == updated_content {
        return;
    }

    *current_content = updated_content.clone();
    drop(current_content);

    let payload = MarkdownUpdatedEvent {
        content: updated_content.clone(),
        path: target_path.display().to_string(),
        render_cache_key: build_render_cache_key(Some(target_path), &updated_content),
    };
    let _ = app_handle.emit(MARKDOWN_UPDATED_EVENT, payload);
}

fn emit_watch_error(
    app_handle: &tauri::AppHandle,
    target_path: Option<&Path>,
    message: impl Into<String>,
) {
    let payload = MarkdownWatchErrorEvent {
        message: message.into(),
        path: target_path.map(|path| path.display().to_string()),
    };
    let _ = app_handle.emit(MARKDOWN_WATCH_ERROR_EVENT, payload);
}
