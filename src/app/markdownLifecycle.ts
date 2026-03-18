import type { UnlistenFn } from "@tauri-apps/api/event";

import {
  loadInitialMarkdownState,
  subscribeToMarkdownUpdates,
} from "../markdown/renderMarkdown";

export async function initializeMarkdownLifecycle(): Promise<UnlistenFn> {
  await loadInitialMarkdownState();
  return subscribeToMarkdownUpdates();
}
