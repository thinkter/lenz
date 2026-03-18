import type { RenderMarkdownRequest, RenderMarkdownResponse } from "./workerProtocol";

type PendingRequest = {
  reject(error: Error): void;
  resolve(chunks: string[]): void;
};

class MarkdownWorkerClient {
  private nextId = 1;
  private pending = new Map<number, PendingRequest>();
  private worker: Worker | null = null;

  async renderFull(content: string): Promise<string[]> {
    const worker = this.getWorker();
    const id = this.nextId;
    this.nextId += 1;

    return await new Promise<string[]>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      const message: RenderMarkdownRequest = {
        content,
        id,
        type: "render-full",
      };
      worker.postMessage(message);
    });
  }

  shutdown(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }

    for (const [, pendingRequest] of this.pending) {
      pendingRequest.reject(new Error("Markdown worker shut down."));
    }
    this.pending.clear();
  }

  private getWorker(): Worker {
    if (this.worker) {
      return this.worker;
    }

    this.worker = new Worker(new URL("./markdown.worker.ts", import.meta.url), {
      type: "module",
    });
    this.worker.addEventListener("message", this.handleMessage);
    this.worker.addEventListener("error", this.handleWorkerError);
    return this.worker;
  }

  private handleMessage = (event: MessageEvent<RenderMarkdownResponse>): void => {
    const message = event.data;
    const pendingRequest = this.pending.get(message.id);
    if (!pendingRequest) {
      return;
    }

    this.pending.delete(message.id);
    if (message.type === "render-full-result") {
      pendingRequest.resolve(message.chunks);
      return;
    }

    pendingRequest.reject(new Error(message.error));
  };

  private handleWorkerError = (event: ErrorEvent): void => {
    const error = new Error(event.message || "Markdown worker failed.");
    for (const [, pendingRequest] of this.pending) {
      pendingRequest.reject(error);
    }
    this.pending.clear();

    if (this.worker) {
      this.worker.removeEventListener("message", this.handleMessage);
      this.worker.removeEventListener("error", this.handleWorkerError);
      this.worker.terminate();
      this.worker = null;
    }
  };
}

export const markdownWorkerClient = new MarkdownWorkerClient();
