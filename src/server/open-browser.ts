/** Best-effort cross-platform browser open; failures are non-fatal. */

import { spawn } from "node:child_process";

export function openBrowser(url: string): void {
  const [cmd, args] = command(url);
  try {
    const child = spawn(cmd, args, { stdio: "ignore", detached: true });
    child.on("error", () => {
      /* swallow — the URL was already printed for the user */
    });
    child.unref();
  } catch {
    /* swallow */
  }
}

function command(url: string): [string, string[]] {
  switch (process.platform) {
    case "darwin":
      return ["open", [url]];
    case "win32":
      // `start` is a cmd builtin; the empty "" is the window title arg.
      return ["cmd", ["/c", "start", "", url]];
    default:
      return ["xdg-open", [url]];
  }
}
