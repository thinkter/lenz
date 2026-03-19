const SCROLL_PROGRESS_ELEMENT_ID = "scroll-progress-indicator";
const MARKDOWN_CONTAINER_SELECTOR = "#markdown-body";

function getScrollElement(): Element {
  return document.scrollingElement ?? document.documentElement;
}

function createIndicatorElement(): HTMLDivElement {
  const existing = document.getElementById(SCROLL_PROGRESS_ELEMENT_ID);
  if (existing instanceof HTMLDivElement) {
    return existing;
  }

  const indicator = document.createElement("div");
  indicator.id = SCROLL_PROGRESS_ELEMENT_ID;
  indicator.className = "scroll-progress-indicator";
  indicator.setAttribute("aria-live", "off");
  indicator.setAttribute("role", "status");
  indicator.textContent = "TOP 0%";
  document.body.append(indicator);
  return indicator;
}

function getProgressLabel(): string {
  const scrollElement = getScrollElement();
  const maxScrollTop = Math.max(0, scrollElement.scrollHeight - window.innerHeight);
  const scrollTop = Math.max(0, scrollElement.scrollTop);
  const percent = maxScrollTop === 0 ? 100 : Math.round((scrollTop / maxScrollTop) * 100);

  const atTop = scrollTop <= 1;
  const atBottom = maxScrollTop > 0 && scrollTop >= maxScrollTop - 1;

  if (atTop) {
    return `TOP ${percent}%`;
  }

  if (atBottom) {
    return `BOT ${percent}%`;
  }

  return `${percent}%`;
}

export function initializeScrollProgressIndicator(): () => void {
  const indicator = createIndicatorElement();

  let frameId: number | null = null;
  const scheduleUpdate = (): void => {
    if (frameId !== null) {
      return;
    }

    frameId = window.requestAnimationFrame(() => {
      frameId = null;
      indicator.textContent = getProgressLabel();
    });
  };

  const mutationObserver = new MutationObserver(() => {
    scheduleUpdate();
  });

  const resizeObserver = new ResizeObserver(() => {
    scheduleUpdate();
  });

  const markdownContainer = document.querySelector(MARKDOWN_CONTAINER_SELECTOR);
  if (markdownContainer) {
    mutationObserver.observe(markdownContainer, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    resizeObserver.observe(markdownContainer);
  }

  resizeObserver.observe(document.documentElement);
  window.addEventListener("scroll", scheduleUpdate, { passive: true });
  window.addEventListener("resize", scheduleUpdate);

  scheduleUpdate();

  return () => {
    window.removeEventListener("scroll", scheduleUpdate);
    window.removeEventListener("resize", scheduleUpdate);
    mutationObserver.disconnect();
    resizeObserver.disconnect();
    if (frameId !== null) {
      window.cancelAnimationFrame(frameId);
      frameId = null;
    }
    indicator.remove();
  };
}
