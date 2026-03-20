mod launcher;
mod markdown;
mod markdown_source;
mod markdown_state;
mod render_cache;
mod settings;
mod watcher;

use markdown::MarkdownState;
use std::env;
use tauri::State;

#[tauri::command]
fn get_markdown(
    app_handle: tauri::AppHandle,
    state: State<'_, MarkdownState>,
) -> markdown::MarkdownResponse {
    markdown::get_markdown(&app_handle, state)
}

#[tauri::command]
fn set_render_cache(
    app_handle: tauri::AppHandle,
    cache_key: String,
    html: String,
) -> Result<(), String> {
    render_cache::write(&app_handle, &cache_key, &html)
}

#[tauri::command]
fn get_zoom_level(app_handle: tauri::AppHandle) -> Result<f64, String> {
    settings::get_zoom_level(&app_handle)
}

#[tauri::command]
fn set_zoom_level(app_handle: tauri::AppHandle, zoom_level: f64) -> Result<f64, String> {
    settings::set_zoom_level(&app_handle, zoom_level)
}

#[tauri::command]
fn open_file(
    app_handle: tauri::AppHandle,
    state: State<'_, MarkdownState>,
    path: String,
) -> Result<markdown::MarkdownResponse, String> {
    markdown::open_file(&app_handle, state, path)
}

fn build_app() -> tauri::Builder<tauri::Wry> {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
}

fn configure_linux_webkit_runtime() {
    #[cfg(target_os = "linux")]
    {
        // Some Linux WebKitGTK setups render a permanently black/blank webview
        // when accelerated compositing or DMA-BUF rendering is enabled.
        if env::var_os("WEBKIT_DISABLE_COMPOSITING_MODE").is_none() {
            env::set_var("WEBKIT_DISABLE_COMPOSITING_MODE", "1");
        }

        if env::var_os("WEBKIT_DISABLE_DMABUF_RENDERER").is_none() {
            env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    configure_linux_webkit_runtime();

    match launcher::detach_to_background() {
        Ok(true) => return,
        Ok(false) => {}
        Err(error) => eprintln!("{error}"),
    }

    let shared_markdown_state = markdown::create_state(markdown::load_from_cli());
    let watcher_state = shared_markdown_state.clone();

    build_app()
        .manage(shared_markdown_state)
        .invoke_handler(tauri::generate_handler![
            get_markdown,
            open_file,
            set_render_cache,
            get_zoom_level,
            set_zoom_level
        ])
        .setup(move |app| {
            let saved_zoom_level = match settings::get_zoom_level(&app.handle()) {
                Ok(zoom_level) => zoom_level,
                Err(error) => {
                    eprintln!(
                        "Failed to load persisted zoom level; falling back to default zoom: {error}"
                    );
                    settings::default_zoom_level()
                }
            };

            if let Err(error) = settings::apply_zoom_level(&app.handle(), saved_zoom_level) {
                eprintln!("Failed to apply startup zoom level: {error}");
            }

            watcher::start(app.handle().clone(), watcher_state.clone());
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
