// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
use notify::event::{CreateKind, ModifyKind, RemoveKind, RenameMode};
use notify::{Config, Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use serde::{Deserialize, Serialize};
use std::env;
use std::fs;
use std::io::IsTerminal;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;
use tauri::{Emitter, Manager, State};

const MARKDOWN_UPDATED_EVENT: &str = "markdown-updated";
const MARKDOWN_WATCH_ERROR_EVENT: &str = "markdown-watch-error";
const SETTINGS_FILE_NAME: &str = "settings.json";
const DETACHED_ENV_VAR: &str = "LENZ_DETACHED";
const DEFAULT_ZOOM_LEVEL: f64 = 1.0;
const MIN_ZOOM_LEVEL: f64 = 0.5;
const MAX_ZOOM_LEVEL: f64 = 2.0;

#[derive(Clone)]
struct MarkdownState(Arc<MarkdownStateInner>);

struct MarkdownStateInner {
    content: Mutex<String>,
    path: Option<PathBuf>,
}

#[derive(Serialize)]
struct MarkdownResponse {
    content: String,
    path: Option<String>,
    live_updates: bool,
}

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

#[derive(Default, Deserialize, Serialize)]
struct AppSettings {
    font_size: Option<u16>,
    zoom_level: Option<f64>,
}

#[tauri::command]
fn get_markdown(state: State<'_, MarkdownState>) -> MarkdownResponse {
    let md = state.0.content.lock().unwrap().clone();
    let path = state.0.path.as_ref().map(|p| p.display().to_string());

    MarkdownResponse {
        content: md,
        live_updates: path.is_some(),
        path,
    }
}

fn normalize_zoom_level(zoom_level: f64) -> f64 {
    (zoom_level.clamp(MIN_ZOOM_LEVEL, MAX_ZOOM_LEVEL) * 10.0).round() / 10.0
}

fn settings_path(app_handle: &tauri::AppHandle) -> Result<PathBuf, String> {
    let config_dir = app_handle
        .path()
        .app_config_dir()
        .map_err(|error| format!("Failed to resolve app config directory: {error}"))?;

    fs::create_dir_all(&config_dir)
        .map_err(|error| format!("Failed to create config directory: {error}"))?;

    Ok(config_dir.join(SETTINGS_FILE_NAME))
}

fn load_settings(app_handle: &tauri::AppHandle) -> Result<AppSettings, String> {
    let path = settings_path(app_handle)?;

    if !path.exists() {
        return Ok(AppSettings::default());
    }

    let contents =
        fs::read_to_string(&path).map_err(|error| format!("Failed to read settings: {error}"))?;

    serde_json::from_str::<AppSettings>(&contents)
        .map_err(|error| format!("Failed to parse settings file `{}`: {error}", path.display()))
}

#[tauri::command]
fn get_zoom_level(app_handle: tauri::AppHandle) -> Result<f64, String> {
    let settings = load_settings(&app_handle)?;

    if let Some(zoom_level) = settings.zoom_level {
        return Ok(normalize_zoom_level(zoom_level));
    }

    if let Some(font_size) = settings.font_size {
        let migrated_zoom_level = normalize_zoom_level(font_size as f64 / 16.0);
        return Ok(migrated_zoom_level);
    }

    Ok(DEFAULT_ZOOM_LEVEL)
}

#[tauri::command]
fn set_zoom_level(app_handle: tauri::AppHandle, zoom_level: f64) -> Result<f64, String> {
    let normalized_zoom_level = normalize_zoom_level(zoom_level);
    let path = settings_path(&app_handle)?;
    let settings = AppSettings {
        font_size: None,
        zoom_level: Some(normalized_zoom_level),
    };
    let contents = serde_json::to_string_pretty(&settings)
        .map_err(|error| format!("Failed to serialize settings: {error}"))?;

    fs::write(&path, contents)
        .map_err(|error| format!("Failed to write settings file `{}`: {error}", path.display()))?;

    Ok(normalized_zoom_level)
}

fn should_detach_from_terminal() -> bool {
    if env::var_os(DETACHED_ENV_VAR).is_some() {
        return false;
    }

    std::io::stdin().is_terminal()
        || std::io::stdout().is_terminal()
        || std::io::stderr().is_terminal()
}

#[cfg(windows)]
fn configure_detached_command(command: &mut Command) {
    use std::os::windows::process::CommandExt;

    const DETACHED_PROCESS: u32 = 0x0000_0008;
    const CREATE_NEW_PROCESS_GROUP: u32 = 0x0000_0200;

    command.creation_flags(DETACHED_PROCESS | CREATE_NEW_PROCESS_GROUP);
}

#[cfg(unix)]
fn configure_detached_command(command: &mut Command) {
    use std::os::unix::process::CommandExt;

    command.process_group(0);
}

fn detach_to_background() -> Result<bool, String> {
    if !should_detach_from_terminal() {
        return Ok(false);
    }

    let current_exe =
        env::current_exe().map_err(|error| format!("Failed to resolve current executable: {error}"))?;
    let current_dir =
        env::current_dir().map_err(|error| format!("Failed to resolve current directory: {error}"))?;
    let args: Vec<_> = env::args_os().skip(1).collect();

    let mut command = Command::new(current_exe);
    command
        .args(args)
        .current_dir(current_dir)
        .env(DETACHED_ENV_VAR, "1")
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null());

    configure_detached_command(&mut command);

    command
        .spawn()
        .map_err(|error| format!("Failed to relaunch lenz in the background: {error}"))?;

    Ok(true)
}

fn non_flag_file_arg() -> Option<String> {
    env::args().skip(1).find(|arg| !arg.starts_with("--"))
}

fn candidate_paths(arg: &str) -> Vec<PathBuf> {
    let input = PathBuf::from(arg);
    let mut candidates = Vec::new();

    // 1) As provided (absolute or relative to process CWD)
    candidates.push(input.clone());

    // 2) Relative to OWD (original working directory when AppImage launched)
    if input.is_relative() {
        if let Ok(owd) = env::var("OWD") {
            let owd_relative = PathBuf::from(owd).join(&input);
            if !candidates.contains(&owd_relative) {
                candidates.push(owd_relative);
            }
        }
    }

    // 3) Relative to APPIMAGE directory (where the AppImage file lives)
    if input.is_relative() {
        if let Ok(appimage) = env::var("APPIMAGE") {
            let appimage_dir_relative = PathBuf::from(appimage).parent().map(|p| p.join(&input));
            if let Some(path) = appimage_dir_relative {
                if !candidates.contains(&path) {
                    candidates.push(path);
                }
            }
        }
    }

    // 4) Relative to executable directory (fallback; often mount dir in AppImage)
    if input.is_relative() {
        if let Ok(exe) = env::current_exe() {
            if let Some(exe_dir) = exe.parent() {
                let exe_relative = exe_dir.join(&input);
                if !candidates.contains(&exe_relative) {
                    candidates.push(exe_relative);
                }
            }
        }
    }

    candidates
}

fn try_read_markdown(arg: &str) -> Result<(String, PathBuf), String> {
    let candidates = candidate_paths(arg);
    let mut attempted = Vec::new();

    for path in &candidates {
        attempted.push(path.display().to_string());
        match fs::read_to_string(path) {
            Ok(content) => {
                let resolved_path = fs::canonicalize(path).unwrap_or_else(|_| path.clone());
                return Ok((content, resolved_path));
            }
            Err(_) => continue,
        }
    }

    let cwd = env::current_dir()
        .map(|p| p.display().to_string())
        .unwrap_or_else(|_| "<unknown>".to_string());
    let owd = env::var("OWD").unwrap_or_else(|_| "<unset>".to_string());
    let appimage = env::var("APPIMAGE").unwrap_or_else(|_| "<unset>".to_string());
    let exe = env::current_exe()
        .map(|p| p.display().to_string())
        .unwrap_or_else(|_| "<unknown>".to_string());

    let details = format!(
        "# Error\nCould not read markdown file `{}`.\n\nTried paths:\n{}\n\nCurrent working directory:\n`{}`\n\nOWD:\n`{}`\n\nAPPIMAGE:\n`{}`\n\nExecutable path:\n`{}`\n",
        arg,
        attempted
            .iter()
            .map(|p| format!("- `{}`", p))
            .collect::<Vec<_>>()
            .join("\n"),
        cwd,
        owd,
        appimage,
        exe
    );

    Err(details)
}

fn path_matches_target(event_path: &Path, target_path: &Path) -> bool {
    if event_path == target_path {
        return true;
    }

    let event_abs = fs::canonicalize(event_path).unwrap_or_else(|_| event_path.to_path_buf());
    let target_abs = fs::canonicalize(target_path).unwrap_or_else(|_| target_path.to_path_buf());
    event_abs == target_abs
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

fn emit_watch_error(
    app_handle: &tauri::AppHandle,
    target_path: Option<&Path>,
    message: impl Into<String>,
) {
    let payload = MarkdownWatchErrorEvent {
        message: message.into(),
        path: target_path.map(|p| p.display().to_string()),
    };
    let _ = app_handle.emit(MARKDOWN_WATCH_ERROR_EVENT, payload);
}

fn start_markdown_watcher(app_handle: tauri::AppHandle, state: MarkdownState) {
    let Some(target_path) = state.0.path.clone() else {
        return;
    };

    thread::spawn(move || {
        let watch_root = target_path
            .parent()
            .map(|p| p.to_path_buf())
            .unwrap_or_else(|| target_path.clone());

        let (event_tx, event_rx) = std::sync::mpsc::channel::<notify::Result<Event>>();

        let mut watcher = match RecommendedWatcher::new(
            move |res| {
                let _ = event_tx.send(res);
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
            match event_result {
                Ok(event) => {
                    if !should_process_event(&event, &target_path) {
                        continue;
                    }

                    match fs::read_to_string(&target_path) {
                        Ok(updated_content) => {
                            let mut current_content = state.0.content.lock().unwrap();
                            if *current_content == updated_content {
                                continue;
                            }

                            *current_content = updated_content.clone();
                            drop(current_content);

                            let payload = MarkdownUpdatedEvent {
                                content: updated_content,
                                path: target_path.display().to_string(),
                            };
                            let _ = app_handle.emit(MARKDOWN_UPDATED_EVENT, payload);
                        }
                        Err(error) => {
                            emit_watch_error(
                                &app_handle,
                                Some(&target_path),
                                format!("File changed but could not be read: {error}"),
                            );
                        }
                    }
                }
                Err(error) => {
                    emit_watch_error(
                        &app_handle,
                        Some(&target_path),
                        format!("Watcher error: {error}"),
                    );
                }
            }
        }
    });
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    match detach_to_background() {
        Ok(true) => return,
        Ok(false) => {}
        Err(error) => eprintln!("{error}"),
    }

    let (markdown_content, resolved_markdown_path) = if let Some(file_arg) = non_flag_file_arg() {
        match try_read_markdown(&file_arg) {
            Ok((content, path)) => (content, Some(path)),
            Err(error_markdown) => (error_markdown, None),
        }
    } else {
        (
            "# Welcome to Lenz\nNo markdown file provided. Usage: `lenz <file.md>`".to_string(),
            None,
        )
    };

    let markdown_state = MarkdownState(Arc::new(MarkdownStateInner {
        content: Mutex::new(markdown_content),
        path: resolved_markdown_path,
    }));
    let watcher_state = markdown_state.clone();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(markdown_state)
        .invoke_handler(tauri::generate_handler![
            get_markdown,
            get_zoom_level,
            set_zoom_level
        ])
        .setup(move |app| {
            start_markdown_watcher(app.handle().clone(), watcher_state.clone());
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
