/** Minimal leveled logger writing to stderr so stdout stays clean for piped JSON. */

export type LogLevel = "silent" | "error" | "warn" | "info" | "debug";

const ORDER: Record<LogLevel, number> = {
  silent: 0,
  error: 1,
  warn: 2,
  info: 3,
  debug: 4,
};

let current: LogLevel = "info";

export function setLogLevel(level: LogLevel): void {
  current = level;
}

function enabled(level: Exclude<LogLevel, "silent">): boolean {
  return ORDER[current] >= ORDER[level];
}

export const log = {
  error(msg: string): void {
    if (enabled("error")) console.error(`error: ${msg}`);
  },
  warn(msg: string): void {
    if (enabled("warn")) console.error(`warn: ${msg}`);
  },
  info(msg: string): void {
    if (enabled("info")) console.error(msg);
  },
  debug(msg: string): void {
    if (enabled("debug")) console.error(`debug: ${msg}`);
  },
};
