declare module "markdown-it-texmath" {
  import type MarkdownIt from "markdown-it";

  type Delimiters = "dollars" | "brackets" | "gitlab" | "julia" | "kramdown";

  interface TexmathOptions {
    engine: { renderToString: (input: string, options?: unknown) => string };
    delimiters?: Delimiters | Delimiters[];
    katexOptions?: Record<string, unknown>;
  }

  const texmath: (md: MarkdownIt, options: TexmathOptions) => void;
  export default texmath;
}
