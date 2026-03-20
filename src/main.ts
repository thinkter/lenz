import { bootstrapApp } from "./app/bootstrap";

window.addEventListener("DOMContentLoaded", () => {
  try {
    bootstrapApp();
  } catch (error) {
    const message = error instanceof Error ? error.stack ?? error.message : String(error);
    document.body.innerHTML = `<pre style="margin:0;padding:20px;color:#ff6b6b;background:#000;white-space:pre-wrap;font:14px/1.5 monospace;">Startup error\n\n${message}</pre>`;
    throw error;
  }
});

window.addEventListener("error", (event) => {
  if (!document.body || document.body.childElementCount > 0) {
    return;
  }

  const message = event.error instanceof Error ? event.error.stack ?? event.error.message : event.message;
  document.body.innerHTML = `<pre style="margin:0;padding:20px;color:#ff6b6b;background:#000;white-space:pre-wrap;font:14px/1.5 monospace;">Startup error\n\n${message}</pre>`;
});

window.addEventListener("unhandledrejection", (event) => {
  if (!document.body || document.body.childElementCount > 0) {
    return;
  }

  const reason = event.reason instanceof Error ? event.reason.stack ?? event.reason.message : String(event.reason);
  document.body.innerHTML = `<pre style="margin:0;padding:20px;color:#ff6b6b;background:#000;white-space:pre-wrap;font:14px/1.5 monospace;">Unhandled promise rejection\n\n${reason}</pre>`;
});
