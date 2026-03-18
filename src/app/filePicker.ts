import { open } from "@tauri-apps/plugin-dialog";

const OPEN_FILE_BUTTON_SELECTOR = "#open-file-button";

type OpenMarkdownFile = (path: string) => Promise<unknown>;

function getOpenFileButton(): HTMLButtonElement | null {
  return document.querySelector(OPEN_FILE_BUTTON_SELECTOR) as HTMLButtonElement | null;
}

function setOpenButtonState(button: HTMLButtonElement, isBusy: boolean): void {
  button.disabled = isBusy;
  button.textContent = isBusy ? "Opening..." : "Open file";
}

export function initializeFilePicker(openMarkdownFile: OpenMarkdownFile): () => void {
  const button = getOpenFileButton();
  if (!button) {
    return () => {};
  }

  let isOpenDialogActive = false;

  const promptForFile = async (): Promise<void> => {
    if (isOpenDialogActive) {
      return;
    }

    isOpenDialogActive = true;
    setOpenButtonState(button, true);

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
      setOpenButtonState(button, false);
    }
  };

  const onOpenFileClick = (): void => {
    void promptForFile();
  };

  button.addEventListener("click", onOpenFileClick);

  return () => {
    button.removeEventListener("click", onOpenFileClick);
  };
}
