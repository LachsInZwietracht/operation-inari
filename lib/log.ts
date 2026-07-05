type LogLevel = "debug" | "info" | "warn" | "error";
type LogMeta = Record<string, unknown>;

/**
 * Minimal structured logger (no dependencies). Server output is one JSON line
 * per entry so hosting-platform log search can filter by level/scope; client
 * output stays human-readable in the browser console.
 *
 * Pass error details via meta, e.g.
 *   log.error("query failed", { error: error instanceof Error ? error.message : String(error) })
 */
function emit(level: LogLevel, scope: string, message: string, meta?: LogMeta) {
  const writer = level === "debug" ? console.debug : console[level];

  if (typeof window === "undefined") {
    writer(
      JSON.stringify({
        time: new Date().toISOString(),
        level,
        scope,
        message,
        ...(meta ? { meta } : {}),
      }),
    );
    return;
  }

  if (meta) {
    writer(`[${scope}] ${message}`, meta);
  } else {
    writer(`[${scope}] ${message}`);
  }
}

export function createLogger(scope: string) {
  return {
    debug: (message: string, meta?: LogMeta) => emit("debug", scope, message, meta),
    info: (message: string, meta?: LogMeta) => emit("info", scope, message, meta),
    warn: (message: string, meta?: LogMeta) => emit("warn", scope, message, meta),
    error: (message: string, meta?: LogMeta) => emit("error", scope, message, meta),
  };
}
