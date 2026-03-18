import { invoke } from "@tauri-apps/api/core";

import { measureAsync } from "./perf";
import { extractMarkdownPayload, type MarkdownPayload } from "./markdownPayload";

export const MARKDOWN_UPDATE_EVENT_NAMES = ["markdown-updated", "markdown_updated"];

export async function loadInitialMarkdownPayload(): Promise<MarkdownPayload> {
  const payload = await measureAsync("load-invoke", () => invoke<unknown>("get_markdown"));
  const markdown = extractMarkdownPayload(payload);
  if (markdown === null) {
    throw new Error("Unexpected payload from get_markdown");
  }

  return markdown;
}

export async function openMarkdownPayload(path: string): Promise<MarkdownPayload> {
  const payload = await invoke<unknown>("open_file", { path });
  const markdown = extractMarkdownPayload(payload);
  if (markdown === null) {
    throw new Error("Unexpected payload from open_file");
  }

  return markdown;
}

export async function persistRenderedMarkdownHtml(
  cacheKey: string,
  html: string,
): Promise<void> {
  await invoke("set_render_cache", {
    cacheKey,
    html,
  });
}
