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
  renderMarkdown();
});
