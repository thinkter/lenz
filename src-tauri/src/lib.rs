mod launcher;
mod markdown;
mod settings;
mod watcher;

use markdown::MarkdownState;
use tauri::State;

#[tauri::command]
fn get_markdown(state: State<'_, MarkdownState>) -> markdown::MarkdownResponse {
    markdown::get_markdown(state)
}

#[tauri::command]
fn get_zoom_level(app_handle: tauri::AppHandle) -> Result<f64, String> {
    settings::get_zoom_level(&app_handle)
}

#[tauri::command]
fn set_zoom_level(app_handle: tauri::AppHandle, zoom_level: f64) -> Result<f64, String> {
    settings::set_zoom_level(&app_handle, zoom_level)
}

fn build_app() -> tauri::Builder<tauri::Wry> {
    tauri::Builder::default().plugin(tauri_plugin_opener::init())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    match launcher::detach_to_background() {
        Ok(true) => return,
        Ok(false) => {}
        Err(error) => eprintln!("{error}"),
    }

    let markdown_state = markdown::create_state(markdown::load_from_cli());
    let watcher_state = markdown_state.clone();

    build_app()
        .manage(markdown_state)
        .invoke_handler(tauri::generate_handler![
            get_markdown,
            get_zoom_level,
            set_zoom_level
        ])
        .setup(move |app| {
            watcher::start(app.handle().clone(), watcher_state.clone());
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
