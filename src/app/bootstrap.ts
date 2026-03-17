import type { UnlistenFn } from "@tauri-apps/api/event";

import { setupVimScrollBindings } from "../keyboard/vimScroll";
import {
  loadInitialMarkdown,
  subscribeToMarkdownUpdates,
} from "../markdown/renderMarkdown";

let stopMarkdownUpdates: UnlistenFn | null = null;

async function initializeMarkdownView(): Promise<void> {
  await loadInitialMarkdown();

  stopMarkdownUpdates = await subscribeToMarkdownUpdates();
}

export function bootstrapApp(): void {
  setupVimScrollBindings();

  void initializeMarkdownView();

  window.addEventListener("beforeunload", () => {
    if (stopMarkdownUpdates) {
      stopMarkdownUpdates();
      stopMarkdownUpdates = null;
    }
  });
}
