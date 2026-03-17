use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;
use tauri::Manager;

const CACHE_DIR_NAME: &str = "render-cache";

#[derive(Deserialize, Serialize)]
struct CachedRenderEntry {
    key: String,
    html: String,
}

pub fn build_cache_key(path: Option<&Path>, content: &str) -> String {
    let path_part = path
        .map(|path| path.display().to_string())
        .unwrap_or_else(|| "<memory>".to_string());
    let modified_part = path.and_then(file_modified_ms).unwrap_or(0);
    let content_hash = fnv1a_hash(content.as_bytes());

    format!("v1:{path_part}:{modified_part}:{content_hash:016x}")
}

pub fn read(app_handle: &tauri::AppHandle, cache_key: &str) -> Result<Option<String>, String> {
    let path = cache_file_path(app_handle, cache_key)?;
    if !path.exists() {
        return Ok(None);
    }

    let contents =
        fs::read_to_string(&path).map_err(|error| format!("Failed to read cache file: {error}"))?;
    let entry = serde_json::from_str::<CachedRenderEntry>(&contents)
        .map_err(|error| format!("Failed to parse cache file `{}`: {error}", path.display()))?;

    if entry.key != cache_key {
        return Ok(None);
    }

    Ok(Some(entry.html))
}

pub fn write(app_handle: &tauri::AppHandle, cache_key: &str, html: &str) -> Result<(), String> {
    let path = cache_file_path(app_handle, cache_key)?;
    let entry = CachedRenderEntry {
        key: cache_key.to_string(),
        html: html.to_string(),
    };
    let contents = serde_json::to_string(&entry)
        .map_err(|error| format!("Failed to serialize render cache: {error}"))?;

    fs::write(&path, contents)
        .map_err(|error| format!("Failed to write cache file `{}`: {error}", path.display()))
}

fn cache_file_path(app_handle: &tauri::AppHandle, cache_key: &str) -> Result<PathBuf, String> {
    let cache_dir = app_handle
        .path()
        .app_cache_dir()
        .map_err(|error| format!("Failed to resolve app cache directory: {error}"))?
        .join(CACHE_DIR_NAME);

    fs::create_dir_all(&cache_dir)
        .map_err(|error| format!("Failed to create render cache directory: {error}"))?;

    Ok(cache_dir.join(format!("{:016x}.json", fnv1a_hash(cache_key.as_bytes()))))
}

fn file_modified_ms(path: &Path) -> Option<u128> {
    let metadata = fs::metadata(path).ok()?;
    let modified = metadata.modified().ok()?;
    let duration = modified.duration_since(UNIX_EPOCH).ok()?;
    Some(duration.as_millis())
}

fn fnv1a_hash(bytes: &[u8]) -> u64 {
    let mut hash = 0xcbf29ce484222325u64;

    for byte in bytes {
        hash ^= u64::from(*byte);
        hash = hash.wrapping_mul(0x100000001b3);
    }

    hash
}
