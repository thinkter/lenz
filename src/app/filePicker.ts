import { open } from "@tauri-apps/plugin-dialog";

type OpenMarkdownFile = (path: string) => Promise<unknown>;

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  if (target.isContentEditable) {
    return true;
  }

  const tagName = target.tagName.toLowerCase();
  return tagName === "input" || tagName === "textarea" || tagName === "select";
}

export function initializeFilePicker(openMarkdownFile: OpenMarkdownFile): () => void {
  let isOpenDialogActive = false;

  const promptForFile = async (): Promise<void> => {
    if (isOpenDialogActive) {
      return;
    }

    isOpenDialogActive = true;

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
    }
  };

  const onKeydown = (event: KeyboardEvent): void => {
    if (event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }

    if (isEditableTarget(event.target)) {
      return;
    }

    if (event.key !== "o") {
      return;
    }

    event.preventDefault();
    void promptForFile();
  };

  window.addEventListener("keydown", onKeydown);

  return () => {
    window.removeEventListener("keydown", onKeydown);
  };
}
