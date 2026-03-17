import { invoke } from "@tauri-apps/api/core";

const DEFAULT_ZOOM_LEVEL = 1;
const MIN_ZOOM_LEVEL = 0.5;
const MAX_ZOOM_LEVEL = 2;
const ZOOM_LEVEL_STEP = 0.1;

let currentZoomLevel = DEFAULT_ZOOM_LEVEL;

function clampZoomLevel(zoomLevel: number): number {
  return Math.min(
    MAX_ZOOM_LEVEL,
    Math.max(MIN_ZOOM_LEVEL, Number(zoomLevel.toFixed(2))),
  );
}

function applyZoomLevel(zoomLevel: number): void {
  currentZoomLevel = clampZoomLevel(zoomLevel);
}

async function persistZoomLevel(zoomLevel: number): Promise<void> {
  const savedZoomLevel = await invoke<number>("set_zoom_level", { zoomLevel });
  applyZoomLevel(savedZoomLevel);
}

function isZoomInShortcut(event: KeyboardEvent): boolean {
  return event.code === "NumpadAdd" || event.key === "+" || event.key === "=";
}

function isZoomOutShortcut(event: KeyboardEvent): boolean {
  return event.code === "NumpadSubtract" || event.key === "-" || event.key === "_";
}

function onFontSizeKeydown(event: KeyboardEvent): void {
  const hasModifier = event.ctrlKey || event.metaKey;
  if (!hasModifier || event.altKey) {
    return;
  }

  if (isZoomInShortcut(event)) {
    event.preventDefault();
    void persistZoomLevel(currentZoomLevel + ZOOM_LEVEL_STEP);
    return;
  }

  if (isZoomOutShortcut(event)) {
    event.preventDefault();
    void persistZoomLevel(currentZoomLevel - ZOOM_LEVEL_STEP);
  }
}

export async function initializeFontSize(): Promise<void> {
  try {
    const savedZoomLevel = await invoke<number>("get_zoom_level");
    applyZoomLevel(savedZoomLevel);
  } catch (error) {
    console.error("Failed to load zoom setting.", error);
    applyZoomLevel(DEFAULT_ZOOM_LEVEL);
  }

  window.addEventListener("keydown", onFontSizeKeydown);
}
