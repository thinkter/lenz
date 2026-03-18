export type MarkdownPayload = {
  content: string;
  path?: string | null;
  renderCacheKey: string;
  cachedHtml: string | null;
};

export function extractMarkdownPayload(payload: unknown): MarkdownPayload | null {
  if (typeof payload === "string") {
    return {
      content: payload,
      path: null,
      renderCacheKey: `memory:${payload.length}`,
      cachedHtml: null,
    };
  }

  if (payload && typeof payload === "object" && "content" in payload) {
    const content = (payload as { content?: unknown }).content;
    const renderCacheKey =
      "render_cache_key" in payload &&
      typeof (payload as { render_cache_key?: unknown }).render_cache_key === "string"
        ? ((payload as { render_cache_key: string }).render_cache_key ?? "")
        : "";

    if (typeof content === "string" && renderCacheKey.length > 0) {
      const cachedHtml =
        "cached_html" in payload &&
        typeof (payload as { cached_html?: unknown }).cached_html === "string"
          ? ((payload as { cached_html?: string }).cached_html ?? null)
          : null;

      return {
        content,
        path:
          "path" in payload && typeof (payload as { path?: unknown }).path === "string"
            ? ((payload as { path?: string }).path ?? null)
            : null,
        renderCacheKey,
        cachedHtml,
      };
    }
  }

  return null;
}
