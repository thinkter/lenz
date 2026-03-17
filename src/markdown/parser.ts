import MarkdownIt from "markdown-it";
import texmath from "markdown-it-texmath";
import katex from "katex";
import type Token from "markdown-it/lib/token.mjs";
import "katex/dist/katex.min.css";

type MarkdownRenderPlan = {
  chunks: string[];
  html: string;
};

export type LazyFullRenderPlan = {
  chunkCount: number;
  renderChunk(index: number): string;
};

function createMarkdownParser(enableMath: boolean): MarkdownIt {
  const markdown = new MarkdownIt({
    html: true,
    linkify: true,
    typographer: true,
  });

  if (enableMath) {
    markdown.use(texmath, {
      engine: katex,
      delimiters: "dollars",
      katexOptions: {
        output: "html",
        throwOnError: false,
        strict: "ignore",
      },
    });
  }

  return markdown;
}

const previewMarkdown = createMarkdownParser(false);
const fullMarkdown = createMarkdownParser(true);

function chunkTokens(tokens: Token[]): Token[][] {
  if (tokens.length === 0) {
    return [];
  }

  const chunks: Token[][] = [];
  let index = 0;

  while (index < tokens.length) {
    const start = index;
    let nesting = tokens[index].nesting;
    index += 1;

    while (index < tokens.length && nesting > 0) {
      nesting += tokens[index].nesting;
      index += 1;
    }

    chunks.push(tokens.slice(start, index));
  }

  return chunks;
}

function buildRenderPlan(markdown: MarkdownIt, content: string): MarkdownRenderPlan {
  const env = {};
  const tokens = markdown.parse(content, env);
  const tokenChunks = chunkTokens(tokens);

  if (tokenChunks.length === 0) {
    const html = markdown.render(content, env);
    return {
      chunks: [html],
      html,
    };
  }

  const chunks = tokenChunks.map((chunk) =>
    markdown.renderer.render(chunk, markdown.options, env),
  );

  return {
    chunks,
    html: chunks.join(""),
  };
}

export function createPreviewRenderPlan(content: string): MarkdownRenderPlan {
  return buildRenderPlan(previewMarkdown, content);
}

export function createLazyFullRenderPlan(content: string): LazyFullRenderPlan {
  const env = {};
  const tokenChunks = chunkTokens(fullMarkdown.parse(content, env));
  const renderedChunks = new Map<number, string>();

  return {
    chunkCount: tokenChunks.length,
    renderChunk(index: number): string {
      const existingChunk = renderedChunks.get(index);
      if (existingChunk !== undefined) {
        return existingChunk;
      }

      const tokenChunk = tokenChunks[index];
      if (!tokenChunk) {
        return "";
      }

      const chunkHtml = fullMarkdown.renderer.render(tokenChunk, fullMarkdown.options, env);
      renderedChunks.set(index, chunkHtml);
      return chunkHtml;
    },
  };
}
