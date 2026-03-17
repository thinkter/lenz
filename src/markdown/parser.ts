// markdown it's texmath plugin returns HTMl
// this file just converts that html into a DOM node so that it can be rendered by the MarkdownIt-V
import MarkdownIt from "markdown-it";
import MarkdownItV from "markdown-it-v";
import texmath from "markdown-it-texmath";
import katex from "katex";
import type Token from "markdown-it/lib/token.mjs";
import "katex/dist/katex.min.css";

const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
});

md.use(MarkdownItV);

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

type VDomRenderer = {
  sDom: {
    openTag(tagName: string, attrs?: Record<string, string>): void;
    closeTag(): void;
    appendText(text: string): void;
  };
};

function renderMath(content: string, displayMode: boolean): string {
  return katex.renderToString(content, {
    displayMode,
    throwOnError: false,
    strict: "ignore",
  });
}

function renderMathToken(
  tokens: Token[],
  idx: number,
  _options: unknown,
  _env: unknown,
  renderer: VDomRenderer,
  displayMode: boolean,
): string {
  const isBlockToken = tokens[idx].type.startsWith("math_block");
  const hasEquationNumber =
    displayMode && tokens[idx].type === "math_block_eqno" && !!tokens[idx].info;

  if (hasEquationNumber) {
    renderer.sDom.openTag("section", { class: "math math-block math-eqno" });
  }

  renderer.sDom.openTag(displayMode && isBlockToken ? "div" : "span", {
    class: displayMode ? "math math-block" : "math math-inline",
    __html: renderMath(tokens[idx].content, displayMode),
  });
  renderer.sDom.closeTag();

  if (hasEquationNumber) {
    renderer.sDom.openTag("span", {
      class: "math-eqno",
    });
    renderer.sDom.appendText(`(${tokens[idx].info})`);
    renderer.sDom.closeTag();
    renderer.sDom.closeTag();
  }

  return "";
}

const mathInlineRule = (
  tokens: Token[],
  idx: number,
  options: unknown,
  env: unknown,
  renderer: unknown,
): string =>
  renderMathToken(tokens, idx, options, env, renderer as VDomRenderer, false);

const mathBlockRule = (
  tokens: Token[],
  idx: number,
  options: unknown,
  env: unknown,
  renderer: unknown,
): string =>
  renderMathToken(tokens, idx, options, env, renderer as VDomRenderer, true);

(md.renderer.rules as Record<string, unknown>).math_inline = mathInlineRule;
(md.renderer.rules as Record<string, unknown>).math_inline_double =
  mathBlockRule;
(md.renderer.rules as Record<string, unknown>).math_block = mathBlockRule;
(md.renderer.rules as Record<string, unknown>).math_block_eqno = mathBlockRule;

type StreamDom = {
  toHTML(): string;
  toNative(doc: Document): Array<string | Node>;
};

export function renderMarkdownToDom(content: string, doc: Document): Node[] {
  const rendered = md.render(content) as unknown as StreamDom;
  return rendered
    .toNative(doc)
    .map((node) =>
      typeof node === "string" ? doc.createTextNode(node) : node,
    );
}
