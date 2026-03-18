use crate::markdown_source;
use crate::markdown_state::MarkdownDocument;
use crate::render_cache;
use serde::Serialize;
use std::path::Path;
use tauri::State;

pub use crate::markdown_state::MarkdownState;

#[derive(Serialize)]
pub struct MarkdownResponse {
    pub content: String,
    pub path: Option<String>,
    pub live_updates: bool,
    pub render_cache_key: String,
    pub cached_html: Option<String>,
}

pub fn load_from_cli() -> MarkdownDocument {
    markdown_source::load_from_cli()
}

pub fn create_state(document: MarkdownDocument) -> MarkdownState {
    MarkdownState::new(document)
}

pub fn get_markdown(app_handle: &tauri::AppHandle, state: State<'_, MarkdownState>) -> MarkdownResponse {
    build_response(app_handle, state.inner().snapshot())
}

pub fn open_file(
    app_handle: &tauri::AppHandle,
    state: State<'_, MarkdownState>,
    path: String,
) -> Result<MarkdownResponse, String> {
    let loaded = markdown_source::read_markdown_file(&path)?;
    let document = loaded.into_document();
    state.replace_document(document.clone());
    Ok(build_response(app_handle, document))
}

pub fn build_render_cache_key(path: Option<&Path>, content: &str) -> String {
    render_cache::build_cache_key(path, content)
}

fn build_response(app_handle: &tauri::AppHandle, document: MarkdownDocument) -> MarkdownResponse {
    let render_cache_key = build_render_cache_key(document.path.as_deref(), &document.content);
    let cached_html = read_cached_html(app_handle, &render_cache_key);

    MarkdownResponse {
        content: document.content,
        path: document.path.as_ref().map(|path| path.display().to_string()),
        live_updates: document.path.is_some(),
        render_cache_key,
        cached_html,
    }
}

fn read_cached_html(app_handle: &tauri::AppHandle, render_cache_key: &str) -> Option<String> {
    render_cache::read(app_handle, render_cache_key)
        .map_err(|error| {
            eprintln!("Failed to load cached render: {error}");
            error
        })
        .ok()
        .flatten()
}
