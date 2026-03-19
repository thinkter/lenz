import { initializeFontSize } from "./fontSize";
import type { UnlistenFn } from "@tauri-apps/api/event";
import { initializeFilePicker } from "./filePicker";
import { initializeMarkdownLifecycle } from "./markdownLifecycle";
import { initializeScrollProgressIndicator } from "./scrollProgress";

import { setupVimScrollBindings } from "../keyboard/vimScroll";
import { openMarkdownFile } from "../markdown/renderMarkdown";

let stopMarkdownUpdates: UnlistenFn | null = null;
let stopFilePicker: (() => void) | null = null;
let stopScrollProgress: (() => void) | null = null;

async function initializeMarkdownView(): Promise<void> {
  stopMarkdownUpdates = await initializeMarkdownLifecycle();
}

export function bootstrapApp(): void {
  setupVimScrollBindings();
  stopFilePicker = initializeFilePicker(openMarkdownFile);
  stopScrollProgress = initializeScrollProgressIndicator();

  void initializeFontSize();
  void initializeMarkdownView();

  window.addEventListener("beforeunload", () => {
    if (stopMarkdownUpdates) {
      stopMarkdownUpdates();
      stopMarkdownUpdates = null;
    }

    if (stopFilePicker) {
      stopFilePicker();
      stopFilePicker = null;
    }

    if (stopScrollProgress) {
      stopScrollProgress();
      stopScrollProgress = null;
    }
  });
}
