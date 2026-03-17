// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
use std::env;
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::State;

struct MarkdownState(Mutex<String>);

#[tauri::command]
fn get_markdown(state: State<'_, MarkdownState>) -> String {
    let md = state.0.lock().unwrap();
    md.clone()
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

fn try_read_markdown(arg: &str) -> Result<String, String> {
    let candidates = candidate_paths(arg);
    let mut attempted = Vec::new();

    for path in &candidates {
        attempted.push(path.display().to_string());
        match fs::read_to_string(path) {
            Ok(content) => return Ok(content),
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let markdown_content = if let Some(file_arg) = non_flag_file_arg() {
        match try_read_markdown(&file_arg) {
            Ok(content) => content,
            Err(error_markdown) => error_markdown,
        }
    } else {
        "# Welcome to Lenz\nNo markdown file provided. Usage: `lenz <file.md>`".to_string()
    };

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(MarkdownState(Mutex::new(markdown_content)))
        .invoke_handler(tauri::generate_handler![get_markdown])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
