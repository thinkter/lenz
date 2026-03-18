import { createFullRenderPlan } from "./parser";
import type { RenderMarkdownRequest, RenderMarkdownResponse } from "./workerProtocol";

function postMessageSafe(message: RenderMarkdownResponse): void {
  self.postMessage(message);
}

self.addEventListener("message", (event: MessageEvent<RenderMarkdownRequest>) => {
  const message = event.data;
  if (message.type !== "render-full") {
    return;
  }

  try {
    const plan = createFullRenderPlan(message.content);
    postMessageSafe({
      chunks: plan.chunks,
      id: message.id,
      type: "render-full-result",
    });
  } catch (error) {
    postMessageSafe({
      error: error instanceof Error ? error.message : String(error),
      id: message.id,
      type: "render-error",
    });
  }
});
