import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import "katex/dist/katex.min.css";

import { createLazyFullRenderPlan, type LazyFullRenderPlan } from "./parser";
import { measureAsync, measureSync, recordPerf, resetPerfCycle } from "./perf";
import { markdownWorkerClient } from "./workerClient";

const MARKDOWN_CONTAINER_SELECTOR = "#markdown-body";
const MARKDOWN_UPDATE_EVENT_NAMES = ["markdown-updated", "markdown_updated"];
const CHUNK_ATTRIBUTE_NAME = "data-markdown-chunk";
const PREVIEW_CHUNK_CLASS_NAME = "markdown-chunk--preview";
const UPGRADE_ROOT_MARGIN = "125% 0px";
const PRIORITY_BATCH_SIZE = 2;
const BACKGROUND_BATCH_SIZE = 1;
const INITIAL_RENDERED_CHUNK_COUNT = 3;

type RenderPlan = {
  chunkCount: number;
  renderChunk(index: number): string;
};

let lastRenderedContent: string | null = null;
let lastRenderedCacheKey: string | null = null;
let pendingContent: string | null = null;
let pendingCacheKey: string | null = null;
let pendingCachedHtml: string | null = null;
let pendingRenderFrameId: number | null = null;
let activeRenderSessionId = 0;
let fullPlanFrameId: number | null = null;
let upgradeFrameId: number | null = null;
let activeObserver: IntersectionObserver | null = null;
let activeRenderCycleStart = 0;

export type MarkdownPayload = {
  content: string;
  path?: string | null;
  renderCacheKey: string;
  cachedHtml: string | null;
};

type ChunkBoundary = {
  start: Comment;
  end: Comment;
  target: HTMLElement | null;
};

type ProgressiveRenderState = {
  cacheKey: string;
  chunkBoundaries: ChunkBoundary[];
  fullPlan: RenderPlan;
  priorityQueue: number[];
  backgroundQueue: number[];
  queuedIndexes: Set<number>;
  upgradedIndexes: Set<number>;
};

let activeProgressiveRenderState: ProgressiveRenderState | null = null;

function getMarkdownContainer(): HTMLElement | null {
  return document.querySelector(MARKDOWN_CONTAINER_SELECTOR) as HTMLElement | null;
}

function clearScheduledFullPlan(): void {
  if (fullPlanFrameId !== null) {
    window.cancelAnimationFrame(fullPlanFrameId);
    fullPlanFrameId = null;
  }
}

function clearUpgradeScheduler(): void {
  if (upgradeFrameId !== null) {
    window.cancelAnimationFrame(upgradeFrameId);
    upgradeFrameId = null;
  }

  if (activeObserver) {
    activeObserver.disconnect();
    activeObserver = null;
  }

  activeProgressiveRenderState = null;
}

function resetPendingRender(): void {
  if (pendingRenderFrameId !== null) {
    window.cancelAnimationFrame(pendingRenderFrameId);
    pendingRenderFrameId = null;
  }

  pendingContent = null;
  pendingCacheKey = null;
  pendingCachedHtml = null;
}

function resetRenderSession(): void {
  activeRenderSessionId += 1;
  clearScheduledFullPlan();
  clearUpgradeScheduler();
  resetPendingRender();
}

function renderMarkdownError(error: unknown): void {
  resetRenderSession();
  lastRenderedContent = null;
  lastRenderedCacheKey = null;

  const container = getMarkdownContainer();
  if (!container) return;
  container.innerHTML = `<p style="color: red;">Error failed to load markdown: ${error}</p>`;
}

function extractMarkdownPayload(payload: unknown): MarkdownPayload | null {
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

function createChunkFragment(index: number, html: string, preview: boolean): DocumentFragment {
  const template = document.createElement("template");
  template.innerHTML = html;

  const elements = Array.from(template.content.children) as HTMLElement[];
  for (const element of elements) {
    element.setAttribute(CHUNK_ATTRIBUTE_NAME, index.toString());
    if (preview) {
      element.classList.add(PREVIEW_CHUNK_CLASS_NAME);
    }
  }

  return template.content.cloneNode(true) as DocumentFragment;
}

function createChunkPlaceholder(index: number): HTMLElement {
  const placeholder = document.createElement("div");
  placeholder.setAttribute(CHUNK_ATTRIBUTE_NAME, index.toString());
  placeholder.classList.add(PREVIEW_CHUNK_CLASS_NAME, "markdown-chunk--placeholder");
  placeholder.setAttribute("aria-hidden", "true");
  return placeholder;
}

function createArrayBackedRenderPlan(chunks: string[]): RenderPlan {
  return {
    chunkCount: chunks.length,
    renderChunk(index: number): string {
      return chunks[index] ?? "";
    },
  };
}

function applyRenderedHtml(content: string, cacheKey: string, html: string): void {
  const container = getMarkdownContainer();
  if (!container) return;

  const template = document.createElement("template");
  template.innerHTML = html;
  container.replaceChildren(template.content.cloneNode(true));
  lastRenderedContent = content;
  lastRenderedCacheKey = cacheKey;
}

function renderChunkHtml(
  fullPlan: RenderPlan,
  index: number,
  stage: "initial" | "priority-upgrade" | "background-upgrade",
): string {
  return measureSync(
    "render-chunk",
    () => fullPlan.renderChunk(index),
    { chunkIndex: index, stage },
  );
}

function applyInitialChunks(
  content: string,
  cacheKey: string,
  fullPlan: RenderPlan,
): ChunkBoundary[] {
  const container = getMarkdownContainer();
  if (!container) return [];

  const fragment = document.createDocumentFragment();
  const boundaries: ChunkBoundary[] = [];
  const initialChunkCount = Math.min(INITIAL_RENDERED_CHUNK_COUNT, fullPlan.chunkCount);

  for (let index = 0; index < fullPlan.chunkCount; index += 1) {
    const start = document.createComment(`chunk:${index}:start`);
    const end = document.createComment(`chunk:${index}:end`);
    let target: HTMLElement | null = null;

    fragment.append(start);
    if (index < initialChunkCount) {
      const chunkFragment = createChunkFragment(
        index,
        renderChunkHtml(fullPlan, index, "initial"),
        true,
      );
      target = chunkFragment.firstElementChild as HTMLElement | null;
      fragment.append(chunkFragment);
    } else {
      const placeholder = createChunkPlaceholder(index);
      target = placeholder;
      fragment.append(placeholder);
    }
    fragment.append(end);
    boundaries.push({
      start,
      end,
      target,
    });
  }

  container.replaceChildren(fragment);
  lastRenderedContent = content;
  lastRenderedCacheKey = cacheKey;
  return boundaries;
}

function replaceChunk(boundary: ChunkBoundary, index: number, html: string): void {
  measureSync(
    "replace-chunk",
    () => {
      const fragment = createChunkFragment(index, html, false);
      const target = fragment.firstElementChild as HTMLElement | null;
      const range = document.createRange();
      range.setStartAfter(boundary.start);
      range.setEndBefore(boundary.end);
      range.deleteContents();
      range.insertNode(fragment);
      boundary.target = target;
    },
    { chunkIndex: index },
  );
}

function serializeContainerHtml(container: HTMLElement): string {
  return Array.from(container.childNodes)
    .filter((node) => node.nodeType !== Node.COMMENT_NODE)
    .map((node) =>
      node.nodeType === Node.ELEMENT_NODE
        ? (node as HTMLElement).outerHTML
        : node.textContent ?? "",
    )
    .join("");
}

async function persistRenderedHtml(cacheKey: string): Promise<void> {
  const container = getMarkdownContainer();
  if (!container) {
    return;
  }

  try {
    await measureAsync(
      "persist-cache",
      () =>
        invoke("set_render_cache", {
          cacheKey,
          html: serializeContainerHtml(container),
        }),
      { htmlLength: container.innerHTML.length },
    );
  } catch (error) {
    console.warn("Failed to persist rendered markdown cache.", error);
  }
}

function scheduleUpgradeFrame(): void {
  if (upgradeFrameId !== null || activeProgressiveRenderState === null) {
    return;
  }

  upgradeFrameId = window.requestAnimationFrame(() => {
    upgradeFrameId = null;

    const state = activeProgressiveRenderState;
    if (!state) {
      return;
    }

    let processed = 0;
    while (state.priorityQueue.length > 0 && processed < PRIORITY_BATCH_SIZE) {
      const index = state.priorityQueue.shift();
      if (index === undefined) {
        break;
      }

      state.queuedIndexes.delete(index);
      if (state.upgradedIndexes.has(index)) {
        continue;
      }

      const boundary = state.chunkBoundaries[index];
      if (!boundary) {
        continue;
      }

      replaceChunk(
        boundary,
        index,
        renderChunkHtml(state.fullPlan, index, "priority-upgrade"),
      );
      state.upgradedIndexes.add(index);
      processed += 1;
    }

    if (processed === 0) {
      let backgroundProcessed = 0;
      while (
        state.backgroundQueue.length > 0 &&
        backgroundProcessed < BACKGROUND_BATCH_SIZE
      ) {
        const index = state.backgroundQueue.shift();
        if (index === undefined) {
          break;
        }

        state.queuedIndexes.delete(index);
        if (state.upgradedIndexes.has(index)) {
          continue;
        }

        const boundary = state.chunkBoundaries[index];
        if (!boundary) {
          continue;
        }

        replaceChunk(
          boundary,
          index,
          renderChunkHtml(state.fullPlan, index, "background-upgrade"),
        );
        state.upgradedIndexes.add(index);
        backgroundProcessed += 1;
      }
    }

    if (state.upgradedIndexes.size === state.fullPlan.chunkCount) {
      const cacheKey = state.cacheKey;
      recordPerf("render-cycle", performance.now() - activeRenderCycleStart, {
        chunkCount: state.fullPlan.chunkCount,
        kind: "progressive-complete",
      });
      clearUpgradeScheduler();
      void persistRenderedHtml(cacheKey);
      return;
    }

    if (state.priorityQueue.length > 0 || state.backgroundQueue.length > 0) {
      scheduleUpgradeFrame();
    }
  });
}

function enqueueChunkUpgrade(index: number, prioritize: boolean): void {
  const state = activeProgressiveRenderState;
  if (!state || state.upgradedIndexes.has(index)) {
    return;
  }

  if (prioritize) {
    if (state.queuedIndexes.has(index)) {
      state.backgroundQueue = state.backgroundQueue.filter(
        (queuedIndex) => queuedIndex !== index,
      );
      if (!state.priorityQueue.includes(index)) {
        state.priorityQueue.push(index);
      }
    } else {
      state.queuedIndexes.add(index);
      state.priorityQueue.push(index);
    }
  } else {
    if (state.queuedIndexes.has(index)) {
      return;
    }
    state.queuedIndexes.add(index);
    state.backgroundQueue.push(index);
  }

  scheduleUpgradeFrame();
}

function startProgressiveUpgrade(
  cacheKey: string,
  fullPlan: RenderPlan,
  chunkBoundaries: ChunkBoundary[],
): void {
  activeProgressiveRenderState = {
    cacheKey,
    chunkBoundaries,
    fullPlan,
    priorityQueue: [],
    backgroundQueue: [],
    queuedIndexes: new Set<number>(),
    upgradedIndexes: new Set<number>(),
  };

  if (typeof IntersectionObserver === "undefined") {
    chunkBoundaries.forEach((_boundary, index) => {
      enqueueChunkUpgrade(index, false);
    });
    scheduleUpgradeFrame();
    return;
  }

  activeObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) {
          continue;
        }

        const index = Number(
          (entry.target as HTMLElement).getAttribute(CHUNK_ATTRIBUTE_NAME),
        );
        if (Number.isNaN(index)) {
          continue;
        }

        enqueueChunkUpgrade(index, true);
      }
    },
    {
      rootMargin: UPGRADE_ROOT_MARGIN,
    },
  );

  chunkBoundaries.forEach((boundary, index) => {
    if (boundary.target) {
      activeObserver?.observe(boundary.target);
    }
    enqueueChunkUpgrade(index, false);
  });

  scheduleUpgradeFrame();
}

function scheduleFullUpgrade(
  sessionId: number,
  cacheKey: string,
  fullPlan: RenderPlan,
  chunkBoundaries: ChunkBoundary[],
): void {
  fullPlanFrameId = window.requestAnimationFrame(() => {
    fullPlanFrameId = window.requestAnimationFrame(() => {
      fullPlanFrameId = null;
      if (sessionId !== activeRenderSessionId) {
        return;
      }

      startProgressiveUpgrade(cacheKey, fullPlan, chunkBoundaries);
    });
  });
}

async function buildRenderPlan(content: string): Promise<RenderPlan> {
  try {
    const chunks = await measureAsync(
      "parse-plan",
      () => markdownWorkerClient.renderFull(content),
      { contentLength: content.length, strategy: "worker" },
    );
    return createArrayBackedRenderPlan(chunks);
  } catch (error) {
    console.warn("Markdown worker failed, falling back to main-thread rendering.", error);
    const fallbackPlan = measureSync(
      "parse-plan",
      () => createLazyFullRenderPlan(content),
      { contentLength: content.length, strategy: "main-thread-fallback" },
    );
    return fallbackPlan as LazyFullRenderPlan;
  }
}

async function flushPendingRender(): Promise<void> {
  pendingRenderFrameId = null;
  resetPerfCycle();
  activeRenderCycleStart = performance.now();

  const content = pendingContent;
  const cacheKey = pendingCacheKey;
  const cachedHtml = pendingCachedHtml;
  pendingContent = null;
  pendingCacheKey = null;
  pendingCachedHtml = null;
  if (content === null || cacheKey === null) {
    return;
  }

  if (content === lastRenderedContent && cacheKey === lastRenderedCacheKey) {
    recordPerf("render-cycle", performance.now() - activeRenderCycleStart, {
      kind: "skipped-identical",
    });
    return;
  }

  if (cachedHtml !== null) {
    recordPerf("cache-hit", 0, { htmlLength: cachedHtml.length });
    applyRenderedHtml(content, cacheKey, cachedHtml);
    recordPerf("render-cycle", performance.now() - activeRenderCycleStart, {
      kind: "cached-html",
    });
    return;
  }

  const sessionId = activeRenderSessionId;
  const fullPlan = await buildRenderPlan(content);
  if (sessionId !== activeRenderSessionId) {
    return;
  }

  const chunkBoundaries = measureSync(
    "initial-render",
    () => applyInitialChunks(content, cacheKey, fullPlan),
    { chunkCount: fullPlan.chunkCount },
  );
  if (chunkBoundaries.length === 0) {
    recordPerf("render-cycle", performance.now() - activeRenderCycleStart, {
      kind: "empty",
    });
    return;
  }

  scheduleFullUpgrade(sessionId, cacheKey, fullPlan, chunkBoundaries);
}

export function renderMarkdownContent(
  content: string,
  renderCacheKey: string,
  cachedHtml: string | null = null,
): void {
  if (
    content === lastRenderedContent &&
    renderCacheKey === lastRenderedCacheKey &&
    pendingRenderFrameId === null
  ) {
    return;
  }

  resetRenderSession();
  pendingContent = content;
  pendingCacheKey = renderCacheKey;
  pendingCachedHtml = cachedHtml;
  pendingRenderFrameId = window.requestAnimationFrame(() => {
    void flushPendingRender();
  });
}

export async function loadInitialMarkdown(): Promise<void> {
  await loadInitialMarkdownState();
}

export async function loadInitialMarkdownState(): Promise<MarkdownPayload> {
  try {
    const payload = await measureAsync("load-invoke", () => invoke<unknown>("get_markdown"));
    const markdown = extractMarkdownPayload(payload);
    if (markdown === null) {
      throw new Error("Unexpected payload from get_markdown");
    }

    renderMarkdownContent(markdown.content, markdown.renderCacheKey, markdown.cachedHtml);
    return markdown;
  } catch (error) {
    console.error("Failed to load markdown content:", error);
    renderMarkdownError(error);
    throw error;
  }
}

export async function openMarkdownFile(path: string): Promise<MarkdownPayload> {
  const payload = await invoke<unknown>("open_file", { path });
  const markdown = extractMarkdownPayload(payload);
  if (markdown === null) {
    throw new Error("Unexpected payload from open_file");
  }

  renderMarkdownContent(markdown.content, markdown.renderCacheKey, markdown.cachedHtml);
  return markdown;
}

export async function subscribeToMarkdownUpdates(): Promise<UnlistenFn> {
  const unlistenHandlers = await Promise.all(
    MARKDOWN_UPDATE_EVENT_NAMES.map((eventName) =>
      listen<unknown>(eventName, (event) => {
        const markdown = extractMarkdownPayload(event.payload);
        if (markdown === null) {
          console.warn(`Ignoring malformed payload for ${eventName}:`, event.payload);
          return;
        }

        renderMarkdownContent(markdown.content, markdown.renderCacheKey, null);
      }),
    ),
  );

  return () => {
    resetRenderSession();
    markdownWorkerClient.shutdown();
    for (const unlisten of unlistenHandlers) {
      unlisten();
    }
  };
}
