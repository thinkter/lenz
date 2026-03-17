use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::Manager;

const SETTINGS_FILE_NAME: &str = "settings.json";
const DEFAULT_ZOOM_LEVEL: f64 = 1.0;
const MIN_ZOOM_LEVEL: f64 = 0.5;
const MAX_ZOOM_LEVEL: f64 = 2.0;
const LEGACY_BASE_FONT_SIZE: f64 = 16.0;

#[derive(Default, Deserialize, Serialize)]
struct AppSettings {
    font_size: Option<u16>,
    zoom_level: Option<f64>,
}

pub fn get_zoom_level(app_handle: &tauri::AppHandle) -> Result<f64, String> {
    let settings = load(app_handle)?;

    if let Some(zoom_level) = settings.zoom_level {
        return Ok(normalize_zoom_level(zoom_level));
    }

    if let Some(font_size) = settings.font_size {
        return Ok(normalize_zoom_level(font_size as f64 / LEGACY_BASE_FONT_SIZE));
    }

    Ok(DEFAULT_ZOOM_LEVEL)
}

pub fn set_zoom_level(app_handle: &tauri::AppHandle, zoom_level: f64) -> Result<f64, String> {
    let normalized_zoom_level = normalize_zoom_level(zoom_level);
    let path = settings_path(app_handle)?;
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

fn normalize_zoom_level(zoom_level: f64) -> f64 {
    (zoom_level.clamp(MIN_ZOOM_LEVEL, MAX_ZOOM_LEVEL) * 10.0).round() / 10.0
}

fn load(app_handle: &tauri::AppHandle) -> Result<AppSettings, String> {
    let path = settings_path(app_handle)?;

    if !path.exists() {
        return Ok(AppSettings::default());
    }

    let contents =
        fs::read_to_string(&path).map_err(|error| format!("Failed to read settings: {error}"))?;

    serde_json::from_str::<AppSettings>(&contents)
        .map_err(|error| format!("Failed to parse settings file `{}`: {error}", path.display()))
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
