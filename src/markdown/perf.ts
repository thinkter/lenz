type PerfPhaseName =
  | "cache-hit"
  | "initial-render"
  | "load-invoke"
  | "parse-plan"
  | "persist-cache"
  | "render-chunk"
  | "render-cycle"
  | "replace-chunk";

type PerfSample = {
  durationMs: number;
  metadata?: Record<string, number | string | boolean>;
  phase: PerfPhaseName;
  timestamp: number;
};

type PerfStore = {
  latestCycle: PerfSample[];
  push(sample: PerfSample): void;
  resetCycle(): void;
};

declare global {
  interface Window {
    __LENZ_PERF__?: PerfStore;
  }
}

function getStore(): PerfStore {
  if (!window.__LENZ_PERF__) {
    window.__LENZ_PERF__ = {
      latestCycle: [],
      push(sample: PerfSample) {
        this.latestCycle.push(sample);
        const metadataSuffix = sample.metadata ? ` ${JSON.stringify(sample.metadata)}` : "";
        console.debug(
          `[lenz:perf] ${sample.phase} ${sample.durationMs.toFixed(2)}ms${metadataSuffix}`,
        );
      },
      resetCycle() {
        this.latestCycle = [];
      },
    };
  }

  return window.__LENZ_PERF__;
}

export function resetPerfCycle(): void {
  getStore().resetCycle();
}

export function recordPerf(
  phase: PerfPhaseName,
  durationMs: number,
  metadata?: Record<string, number | string | boolean>,
): void {
  getStore().push({
    durationMs,
    metadata,
    phase,
    timestamp: performance.now(),
  });
}

export function measureSync<T>(
  phase: PerfPhaseName,
  callback: () => T,
  metadata?: Record<string, number | string | boolean>,
): T {
  const start = performance.now();
  const result = callback();
  recordPerf(phase, performance.now() - start, metadata);
  return result;
}

export async function measureAsync<T>(
  phase: PerfPhaseName,
  callback: () => Promise<T>,
  metadata?: Record<string, number | string | boolean>,
): Promise<T> {
  const start = performance.now();
  const result = await callback();
  recordPerf(phase, performance.now() - start, metadata);
  return result;
}
