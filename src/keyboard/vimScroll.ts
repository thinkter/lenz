const DOUBLE_G_WINDOW_MS = 350;
const FALLBACK_LINE_SCROLL_STEP_PX = 48;

let lastGPressAt: number | null = null;

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;

  if (target.isContentEditable) return true;

  const tagName = target.tagName.toLowerCase();
  return tagName === "input" || tagName === "textarea" || tagName === "select";
}

function getScrollElement(): Element {
  return document.scrollingElement ?? document.documentElement;
}

function getLineScrollStep(): number {
  const lineHeight = Number.parseFloat(
    getComputedStyle(document.body).lineHeight,
  );
  if (Number.isFinite(lineHeight) && lineHeight > 0) {
    return Math.max(24, Math.round(lineHeight * 3));
  }

  return FALLBACK_LINE_SCROLL_STEP_PX;
}

function handleVimScrollKeydown(event: KeyboardEvent): void {
  if (event.ctrlKey || event.metaKey || event.altKey) {
    lastGPressAt = null;
    return;
  }

  if (isEditableTarget(event.target)) {
    lastGPressAt = null;
    return;
  }

  const key = event.key;
  const scrollStep = getLineScrollStep();

  if (key === "j") {
    window.scrollBy({ top: scrollStep, behavior: "auto" });
    lastGPressAt = null;
    event.preventDefault();
    return;
  }

  if (key === "k") {
    window.scrollBy({ top: -scrollStep, behavior: "auto" });
    lastGPressAt = null;
    event.preventDefault();
    return;
  }

  if (key === "G") {
    const scrollElement = getScrollElement();
    const maxScrollTop = scrollElement.scrollHeight - window.innerHeight;
    window.scrollTo({ top: Math.max(0, maxScrollTop), behavior: "auto" });
    lastGPressAt = null;
    event.preventDefault();
    return;
  }

  if (key === "g") {
    const now = Date.now();
    if (lastGPressAt !== null && now - lastGPressAt <= DOUBLE_G_WINDOW_MS) {
      window.scrollTo({ top: 0, behavior: "auto" });
      lastGPressAt = null;
      event.preventDefault();
      return;
    }

    lastGPressAt = now;
    return;
  }

  lastGPressAt = null;
}

export function setupVimScrollBindings(): void {
  window.addEventListener("keydown", handleVimScrollKeydown);
}
