import { setupVimScrollBindings } from "../keyboard/vimScroll";
import { renderMarkdown } from "../markdown/renderMarkdown";

export function bootstrapApp(): void {
  setupVimScrollBindings();
  void renderMarkdown();
}
