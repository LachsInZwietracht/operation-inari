import type { AppMode } from "@/lib/types";

/**
 * Active surface (counselor app vs. client app). Stored in a cookie rather
 * than React state so server components and middleware resolve the same
 * surface on first render.
 *
 * The cookie is a view preference only. Every authorization decision comes
 * from RLS and `client_links` — never from this value.
 */
export const APP_MODE_COOKIE = "prodi_mode";

export const APP_MODE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/** Every client-mode route lives under this prefix. */
export const CLIENT_ROUTE_PREFIX = "/klient";

export const CLIENT_HOME_ROUTE = "/klient";
export const COUNSELOR_HOME_ROUTE = "/dashboard";

/**
 * A food diary day is a calendar day where the person eats, so the date is
 * resolved in the product's home time zone instead of the server's. Without
 * this a UTC-hosted server would flip "today" at 01:00 local time.
 */
export const APP_TIME_ZONE = "Europe/Berlin";

/** ISO date (YYYY-MM-DD) — "sv-SE" formats exactly that way. */
export function todayIsoDate(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: APP_TIME_ZONE }).format(now);
}

export function isIsoDate(value: string | null | undefined): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function parseAppMode(value: string | null | undefined): AppMode {
  return value === "client" ? "client" : "counselor";
}

export function isClientRoute(pathname: string): boolean {
  return pathname === CLIENT_ROUTE_PREFIX || pathname.startsWith(`${CLIENT_ROUTE_PREFIX}/`);
}

export function homeRouteForMode(mode: AppMode): string {
  return mode === "client" ? CLIENT_HOME_ROUTE : COUNSELOR_HOME_ROUTE;
}

/**
 * Invite codes are shown to humans and typed by hand, so the alphabet drops
 * characters that read alike (0/O, 1/I/L). 8 chars over a 30 character
 * alphabet is ~39 bits — combined with server-side expiry and single use,
 * enough for a code that is only useful to whoever the counselor sends it to.
 */
export const INVITE_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const INVITE_CODE_LENGTH = 8;

export function normalizeInviteCode(value: string): string {
  return value.trim().toUpperCase().replace(/[\s-]/g, "");
}

export function isValidInviteCodeFormat(value: string): boolean {
  const normalized = normalizeInviteCode(value);
  if (normalized.length !== INVITE_CODE_LENGTH) return false;
  return [...normalized].every((char) => INVITE_CODE_ALPHABET.includes(char));
}

/** Groups an invite code for display: ABCD-EFGH. */
export function formatInviteCode(value: string): string {
  const normalized = normalizeInviteCode(value);
  if (normalized.length !== INVITE_CODE_LENGTH) return normalized;
  return `${normalized.slice(0, 4)}-${normalized.slice(4)}`;
}
