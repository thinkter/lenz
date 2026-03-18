export type RenderMarkdownRequest = {
  content: string;
  id: number;
  type: "render-full";
};

export type RenderMarkdownResponse =
  | {
      chunks: string[];
      id: number;
      type: "render-full-result";
    }
  | {
      error: string;
      id: number;
      type: "render-error";
    };
