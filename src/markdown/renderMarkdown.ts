import { invoke } from "@tauri-apps/api/core";

import { renderMarkdownToHtml } from "./parser";

const MARKDOWN_CONTAINER_SELECTOR = "#markdown-body";

function getMarkdownContainer(): HTMLElement | null {
  return document.querySelector(MARKDOWN_CONTAINER_SELECTOR) as HTMLElement | null;
}

export async function renderMarkdown(): Promise<void> {
  const container = getMarkdownContainer();
  if (!container) return;

  try {
    const content: string = await invoke("get_markdown");
    container.innerHTML = renderMarkdownToHtml(content);
  } catch (error) {
    console.error("Failed to load markdown content:", error);
    container.innerHTML = `<p style="color: red;">Error failed to load markdown: ${error}</p>`;
  }
}
