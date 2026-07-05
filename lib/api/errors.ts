import { NextResponse } from "next/server";

import { createLogger } from "@/lib/log";

const log = createLogger("api");

const KNOWN_ERROR_STATUS: Record<string, number> = {
  AUTH_REQUIRED: 401,
  FORBIDDEN: 403,
  API_KEY_NAME_REQUIRED: 400,
  API_KEY_EXPIRY_INVALID: 400,
  API_KEY_NOT_FOUND: 404,
};

/**
 * Maps known error codes (thrown as Error messages by the data layer) to HTTP
 * responses. Unknown errors are logged server-side and returned as a generic
 * INTERNAL_ERROR so internal details never leak to clients.
 */
export function toErrorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const status = KNOWN_ERROR_STATUS[message];
  if (status) {
    return NextResponse.json({ error: message }, { status });
  }

  log.error("Unhandled API route error", { error: message });
  return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
}
