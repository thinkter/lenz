import { invoke } from "@tauri-apps/api/core";
import MarkdownIt from "markdown-it";
import texmath from "markdown-it-texmath";
import katex from "katex";
import "katex/dist/katex.min.css";

const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
});

// Enable LaTeX parsing using dollar delimiters:
// - Inline: $...$
// - Block: $$...$$
md.use(texmath, {
  engine: katex,
  delimiters: "dollars",
  katexOptions: {
    throwOnError: false,
    strict: "ignore",
  },
});

const DOUBLE_G_WINDOW_MS = 350;
const SCROLL_STEP_RATIO = 0.12;
let lastGPressAt: number | null = null;

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;

  if (target.isContentEditable) return true;

  const tagName = target.tagName.toLowerCase();
  return tagName === "input" || tagName === "textarea" || tagName === "select";
}

function getScrollElement(): Element {
  return document.scrollingElement ?? document.documentElement;
}

function handleVimScrollKeydown(event: KeyboardEvent) {
  if (event.ctrlKey || event.metaKey || event.altKey) {
    lastGPressAt = null;
    return;
  }

  if (isEditableTarget(event.target)) {
    lastGPressAt = null;
    return;
  }

  const key = event.key;
  const scrollStep = Math.max(40, Math.round(window.innerHeight * SCROLL_STEP_RATIO));

  if (key === "j") {
    window.scrollBy({ top: scrollStep, behavior: "auto" });
    lastGPressAt = null;
    event.preventDefault();
    return;
  }

  if (key === "k") {
    window.scrollBy({ top: -scrollStep, behavior: "auto" });
    lastGPressAt = null;
    event.preventDefault();
    return;
  }

  if (key === "G") {
    const scrollElement = getScrollElement();
    const maxScrollTop = scrollElement.scrollHeight - window.innerHeight;
    window.scrollTo({ top: Math.max(0, maxScrollTop), behavior: "auto" });
    lastGPressAt = null;
    event.preventDefault();
    return;
  }

  if (key === "g") {
    const now = Date.now();
    if (lastGPressAt !== null && now - lastGPressAt <= DOUBLE_G_WINDOW_MS) {
      window.scrollTo({ top: 0, behavior: "auto" });
      lastGPressAt = null;
      event.preventDefault();
      return;
    }

    lastGPressAt = now;
    return;
  }

  lastGPressAt = null;
}

async function renderMarkdown() {
  const container = document.querySelector(
    "#markdown-body",
  ) as HTMLElement | null;
  if (!container) return;

  try {
    const content: string = await invoke("get_markdown");
    container.innerHTML = md.render(content);
  } catch (error) {
    console.error("Failed to load markdown content:", error);
    container.innerHTML = `<p style="color: red;">Error failed to load markdown: ${error}</p>`;
  }
}

window.addEventListener("DOMContentLoaded", () => {
  window.addEventListener("keydown", handleVimScrollKeydown);
  renderMarkdown();
});
