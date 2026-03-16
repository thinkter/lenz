// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
use std::env;
use std::fs;
use std::sync::Mutex;
use tauri::State;

struct MarkdownState(Mutex<String>);

#[tauri::command]
fn get_markdown(state: State<'_, MarkdownState>) -> String {
    let md = state.0.lock().unwrap();
    md.clone()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let args: Vec<String> = env::args().collect();

    // Look for the first argument that isn't the executable
    let markdown_content = if let Some(file_path) = args.iter().skip(1).find(|arg| !arg.starts_with("--")) {
        if let Ok(content) = fs::read_to_string(file_path) {
            content
        } else {
            format!("# Error\nCould not read file `{}`", file_path)
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
