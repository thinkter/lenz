import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

import { renderMarkdownToDom } from "./parser";

const MARKDOWN_CONTAINER_SELECTOR = "#markdown-body";
const MARKDOWN_UPDATE_EVENT_NAMES = ["markdown-updated", "markdown_updated"];

function getMarkdownContainer(): HTMLElement | null {
  return document.querySelector(MARKDOWN_CONTAINER_SELECTOR) as HTMLElement | null;
}

function renderMarkdownError(error: unknown): void {
  const container = getMarkdownContainer();
  if (!container) return;
  container.innerHTML = `<p style="color: red;">Error failed to load markdown: ${error}</p>`;
}

function extractMarkdownContent(payload: unknown): string | null {
  if (typeof payload === "string") {
    return payload;
  }

  if (payload && typeof payload === "object" && "content" in payload) {
    const content = (payload as { content?: unknown }).content;
    if (typeof content === "string") {
      return content;
    }
  }

  return null;
}

export function renderMarkdownContent(content: string): void {
  const container = getMarkdownContainer();
  if (!container) return;
  container.replaceChildren(...renderMarkdownToDom(content, document));
}

export async function loadInitialMarkdown(): Promise<void> {
  try {
    const payload = await invoke<unknown>("get_markdown");
    const content = extractMarkdownContent(payload);
    if (content === null) {
      throw new Error("Unexpected payload from get_markdown");
    }

    renderMarkdownContent(content);
  } catch (error) {
    console.error("Failed to load markdown content:", error);
    renderMarkdownError(error);
  }
}

export async function subscribeToMarkdownUpdates(): Promise<UnlistenFn> {
  const unlistenHandlers = await Promise.all(
    MARKDOWN_UPDATE_EVENT_NAMES.map((eventName) =>
      listen<unknown>(eventName, (event) => {
        const content = extractMarkdownContent(event.payload);
        if (content === null) {
          console.warn(`Ignoring malformed payload for ${eventName}:`, event.payload);
          return;
        }
        renderMarkdownContent(content);
      }),
    ),
  );

  return () => {
    for (const unlisten of unlistenHandlers) {
      unlisten();
    }
  };
}
