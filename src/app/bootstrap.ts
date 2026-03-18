import { initializeFontSize } from "./fontSize";
import type { UnlistenFn } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";

import { setupVimScrollBindings } from "../keyboard/vimScroll";
import {
  loadInitialMarkdownState,
  openMarkdownFile,
  subscribeToMarkdownUpdates,
} from "../markdown/renderMarkdown";

let stopMarkdownUpdates: UnlistenFn | null = null;
let isOpenDialogActive = false;

function getOpenFileButton(): HTMLButtonElement | null {
  return document.querySelector("#open-file-button") as HTMLButtonElement | null;
}

function setOpenButtonState(isBusy: boolean): void {
  const button = getOpenFileButton();
  if (!button) {
    return;
  }

  button.disabled = isBusy;
  button.textContent = isBusy ? "Opening..." : "Open file";
}

async function promptForFile(): Promise<void> {
  if (isOpenDialogActive) {
    return;
  }

  isOpenDialogActive = true;
  setOpenButtonState(true);

  try {
    const selection = await open({
      directory: false,
      multiple: false,
    });
    if (typeof selection !== "string" || selection.length === 0) {
      return;
    }

    await openMarkdownFile(selection);
  } catch (error) {
    console.error("Failed to open file:", error);
  } finally {
    isOpenDialogActive = false;
    setOpenButtonState(false);
  }
}

async function initializeMarkdownView(): Promise<void> {
  const markdown = await loadInitialMarkdownState();

  stopMarkdownUpdates = await subscribeToMarkdownUpdates();

  if (!markdown.path) {
    await promptForFile();
  }
}

function setupOpenFileButton(): void {
  const button = getOpenFileButton();
  if (!button) {
    return;
  }

  button.addEventListener("click", () => {
    void promptForFile();
  });
}

export function bootstrapApp(): void {
  setupVimScrollBindings();
  setupOpenFileButton();

  void initializeFontSize();
  void initializeMarkdownView();

  window.addEventListener("beforeunload", () => {
    if (stopMarkdownUpdates) {
      stopMarkdownUpdates();
      stopMarkdownUpdates = null;
    }
  });
}
