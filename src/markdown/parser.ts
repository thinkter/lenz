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

export function renderMarkdownToHtml(content: string): string {
  return md.render(content);
}
