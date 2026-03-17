use crate::markdown::MarkdownState;
use notify::event::{CreateKind, ModifyKind, RemoveKind, RenameMode};
use notify::{Config, Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use serde::Serialize;
use std::fs;
use std::path::Path;
use std::thread;
use std::time::Duration;
use tauri::Emitter;

const MARKDOWN_UPDATED_EVENT: &str = "markdown-updated";
const MARKDOWN_WATCH_ERROR_EVENT: &str = "markdown-watch-error";

#[derive(Clone, Serialize)]
struct MarkdownUpdatedEvent {
    content: String,
    path: String,
}

#[derive(Clone, Serialize)]
struct MarkdownWatchErrorEvent {
    message: String,
    path: Option<String>,
}

pub fn start(app_handle: tauri::AppHandle, state: MarkdownState) {
    let Some(target_path) = state.0.path.clone() else {
        return;
    };

    thread::spawn(move || {
        let watch_root = target_path
            .parent()
            .map(Path::to_path_buf)
            .unwrap_or_else(|| target_path.clone());

        let (event_tx, event_rx) = std::sync::mpsc::channel::<notify::Result<Event>>();

        let mut watcher = match RecommendedWatcher::new(
            move |result| {
                let _ = event_tx.send(result);
            },
            Config::default().with_poll_interval(Duration::from_millis(200)),
        ) {
            Ok(watcher) => watcher,
            Err(error) => {
                emit_watch_error(
                    &app_handle,
                    Some(&target_path),
                    format!("Failed to initialize file watcher: {error}"),
                );
                return;
            }
        };

        if let Err(error) = watcher.watch(&watch_root, RecursiveMode::NonRecursive) {
            emit_watch_error(
                &app_handle,
                Some(&target_path),
                format!("Failed to watch path `{}`: {error}", watch_root.display()),
            );
            return;
        }

        while let Ok(event_result) = event_rx.recv() {
            handle_event_result(&app_handle, &state, &target_path, event_result);
        }
    });
}

fn handle_event_result(
    app_handle: &tauri::AppHandle,
    state: &MarkdownState,
    target_path: &Path,
    event_result: notify::Result<Event>,
) {
    match event_result {
        Ok(event) => handle_watch_event(app_handle, state, target_path, event),
        Err(error) => emit_watch_error(
            app_handle,
            Some(target_path),
            format!("Watcher error: {error}"),
        ),
    }
}

fn handle_watch_event(
    app_handle: &tauri::AppHandle,
    state: &MarkdownState,
    target_path: &Path,
    event: Event,
) {
    if !should_process_event(&event, target_path) {
        return;
    }

    match fs::read_to_string(target_path) {
        Ok(updated_content) => emit_markdown_update(app_handle, state, target_path, updated_content),
        Err(error) => emit_watch_error(
            app_handle,
            Some(target_path),
            format!("File changed but could not be read: {error}"),
        ),
    }
}

fn emit_markdown_update(
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
        content: updated_content,
        path: target_path.display().to_string(),
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

fn should_process_event(event: &Event, target_path: &Path) -> bool {
    let is_content_event = matches!(
        event.kind,
        EventKind::Modify(ModifyKind::Data(_))
            | EventKind::Modify(ModifyKind::Any)
            | EventKind::Modify(ModifyKind::Name(RenameMode::Both))
            | EventKind::Modify(ModifyKind::Name(RenameMode::To))
            | EventKind::Create(CreateKind::File)
            | EventKind::Create(CreateKind::Any)
            | EventKind::Remove(RemoveKind::File)
            | EventKind::Any
    );

    if !is_content_event {
        return false;
    }

    if event.paths.is_empty() {
        return true;
    }

    event
        .paths
        .iter()
        .any(|event_path| path_matches_target(event_path, target_path))
}

fn path_matches_target(event_path: &Path, target_path: &Path) -> bool {
    if event_path == target_path {
        return true;
    }

    let event_abs = fs::canonicalize(event_path).unwrap_or_else(|_| event_path.to_path_buf());
    let target_abs = fs::canonicalize(target_path).unwrap_or_else(|_| target_path.to_path_buf());
    event_abs == target_abs
}
