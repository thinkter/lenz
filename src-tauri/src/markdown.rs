use serde::Serialize;
use std::env;
use std::fs;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use tauri::State;

#[derive(Clone)]
pub struct MarkdownState(pub Arc<MarkdownStateInner>);

pub struct MarkdownStateInner {
    pub content: Mutex<String>,
    pub path: Option<PathBuf>,
}

#[derive(Serialize)]
pub struct MarkdownResponse {
    pub content: String,
    pub path: Option<String>,
    pub live_updates: bool,
}

#[derive(Clone)]
pub struct MarkdownDocument {
    pub content: String,
    pub path: Option<PathBuf>,
}

pub fn load_from_cli() -> MarkdownDocument {
    if let Some(file_arg) = non_flag_file_arg() {
        match try_read_markdown(&file_arg) {
            Ok((content, path)) => MarkdownDocument {
                content,
                path: Some(path),
            },
            Err(error_markdown) => MarkdownDocument {
                content: error_markdown,
                path: None,
            },
        }
    } else {
        MarkdownDocument {
            content: "# Welcome to Lenz\nNo markdown file provided. Usage: `lenz <file.md>`"
                .to_string(),
            path: None,
        }
    }
}

pub fn create_state(document: MarkdownDocument) -> MarkdownState {
    MarkdownState(Arc::new(MarkdownStateInner {
        content: Mutex::new(document.content),
        path: document.path,
    }))
}

pub fn get_markdown(state: State<'_, MarkdownState>) -> MarkdownResponse {
    let markdown = state.0.content.lock().unwrap().clone();
    let path = state.0.path.as_ref().map(|path| path.display().to_string());

    MarkdownResponse {
        content: markdown,
        path,
        live_updates: state.0.path.is_some(),
    }
}

fn non_flag_file_arg() -> Option<String> {
    env::args().skip(1).find(|arg| !arg.starts_with("--"))
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

    Err(build_read_error(arg, &attempted))
}

fn candidate_paths(arg: &str) -> Vec<PathBuf> {
    let input = PathBuf::from(arg);
    let mut candidates = vec![input.clone()];

    if input.is_relative() {
        push_unique_candidate(
            &mut candidates,
            env::var("OWD").ok().map(|owd| PathBuf::from(owd).join(&input)),
        );

        push_unique_candidate(
            &mut candidates,
            env::var("APPIMAGE")
                .ok()
                .and_then(|appimage| PathBuf::from(appimage).parent().map(|path| path.join(&input))),
        );

        push_unique_candidate(
            &mut candidates,
            env::current_exe()
                .ok()
                .and_then(|exe| exe.parent().map(|path| path.join(&input))),
        );
    }

    candidates
}

fn push_unique_candidate(candidates: &mut Vec<PathBuf>, candidate: Option<PathBuf>) {
    if let Some(candidate) = candidate {
        if !candidates.contains(&candidate) {
            candidates.push(candidate);
        }
    }
}

fn build_read_error(arg: &str, attempted: &[String]) -> String {
    let cwd = env::current_dir()
        .map(|path| path.display().to_string())
        .unwrap_or_else(|_| "<unknown>".to_string());
    let owd = env::var("OWD").unwrap_or_else(|_| "<unset>".to_string());
    let appimage = env::var("APPIMAGE").unwrap_or_else(|_| "<unset>".to_string());
    let exe = env::current_exe()
        .map(|path| path.display().to_string())
        .unwrap_or_else(|_| "<unknown>".to_string());

    format!(
        "# Error\nCould not read markdown file `{}`.\n\nTried paths:\n{}\n\nCurrent working directory:\n`{}`\n\nOWD:\n`{}`\n\nAPPIMAGE:\n`{}`\n\nExecutable path:\n`{}`\n",
        arg,
        attempted
            .iter()
            .map(|path| format!("- `{}`", path))
            .collect::<Vec<_>>()
            .join("\n"),
        cwd,
        owd,
        appimage,
        exe
    )
}
