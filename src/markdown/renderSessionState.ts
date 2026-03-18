export type PendingRender = {
  content: string;
  cacheKey: string;
  cachedHtml: string | null;
};

export type RenderSessionState = {
  lastRenderedContent: string | null;
  lastRenderedCacheKey: string | null;
  pending: PendingRender | null;
  pendingRenderFrameId: number | null;
  activeRenderSessionId: number;
  fullPlanFrameId: number | null;
  upgradeFrameId: number | null;
  activeRenderCycleStart: number;
};

export function createRenderSessionState(): RenderSessionState {
  return {
    lastRenderedContent: null,
    lastRenderedCacheKey: null,
    pending: null,
    pendingRenderFrameId: null,
    activeRenderSessionId: 0,
    fullPlanFrameId: null,
    upgradeFrameId: null,
    activeRenderCycleStart: 0,
  };
}
