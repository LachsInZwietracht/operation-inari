"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  APP_MODE_COOKIE,
  APP_MODE_COOKIE_MAX_AGE,
  homeRouteForMode,
  isValidInviteCodeFormat,
  normalizeInviteCode,
} from "@/lib/client-mode";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getVerifiedUser } from "@/lib/supabase/verified-user";
import type { AppMode } from "@/lib/types";

export interface ClientModeActionResult {
  status: "success" | "error";
  message: string | null;
}

/**
 * Switches the active surface and lands on that surface's home. The cookie is
 * a view preference — it grants nothing on its own.
 */
export async function setAppModeAction(mode: AppMode): Promise<void> {
  const target: AppMode = mode === "client" ? "client" : "counselor";
  const cookieStore = await cookies();

  cookieStore.set(APP_MODE_COOKIE, target, {
    httpOnly: false,
    sameSite: "lax",
    path: "/",
    maxAge: APP_MODE_COOKIE_MAX_AGE,
  });

  redirect(homeRouteForMode(target));
}

const redeemSchema = z.object({
  code: z.string().trim().min(1, "Bitte gib deinen Einladungscode ein."),
});

/**
 * Redeems a counselor invite for the signed-in user.
 *
 * Runs with the service-role client because an open invite is not readable
 * through RLS — the redeeming user is not yet a participant of the link. The
 * session user is resolved from the RLS-scoped client first, so the caller
 * can only ever bind the link to themselves.
 *
 * Self-linking is allowed on purpose: a counselor testing the client surface
 * (or being their own client) is a legitimate case.
 */
export async function redeemClientInviteAction(
  input: { code: string },
): Promise<ClientModeActionResult> {
  const parsed = redeemSchema.safeParse(input);
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Ungültige Eingabe." };
  }

  const code = normalizeInviteCode(parsed.data.code);
  if (!isValidInviteCodeFormat(code)) {
    return { status: "error", message: "Dieser Einladungscode hat nicht das richtige Format." };
  }

  try {
    const supabase = await createClient();
    const user = await getVerifiedUser(supabase);

    if (!user) {
      return { status: "error", message: "Bitte melde dich an, um die Einladung anzunehmen." };
    }

    const service = await createServiceClient();
    const { data: link, error: lookupError } = await service
      .from("client_links")
      .select("id,status,invite_expires_at,client_user_id")
      .eq("invite_code", code)
      .maybeSingle();

    if (lookupError) {
      return { status: "error", message: "Die Einladung konnte nicht geprüft werden." };
    }

    if (!link) {
      return { status: "error", message: "Diesen Einladungscode gibt es nicht." };
    }

    if (link.status === "active") {
      return {
        status: "error",
        message:
          link.client_user_id === user.id
            ? "Diese Einladung hast du bereits angenommen."
            : "Diese Einladung wurde bereits von jemand anderem eingelöst.",
      };
    }

    if (link.status === "revoked") {
      return { status: "error", message: "Diese Einladung wurde zurückgezogen." };
    }

    if (link.invite_expires_at && new Date(link.invite_expires_at) < new Date()) {
      return {
        status: "error",
        message: "Diese Einladung ist abgelaufen. Bitte lass dir eine neue schicken.",
      };
    }

    const now = new Date().toISOString();
    const { error: updateError } = await service
      .from("client_links")
      .update({
        client_user_id: user.id,
        status: "active",
        consent_nutrition: true,
        consent_training: true,
        consent_wellbeing: true,
        consented_at: now,
        updated_at: now,
      })
      .eq("id", link.id)
      .eq("status", "invited");

    if (updateError) {
      return { status: "error", message: "Die Einladung konnte nicht angenommen werden." };
    }

    const cookieStore = await cookies();
    cookieStore.set(APP_MODE_COOKIE, "client", {
      httpOnly: false,
      sameSite: "lax",
      path: "/",
      maxAge: APP_MODE_COOKIE_MAX_AGE,
    });

    revalidatePath("/klient");
    revalidatePath("/klient/betreuung");

    return { status: "success", message: "Verbindung hergestellt." };
  } catch (error) {
    console.error("Failed to redeem client invite:", error);
    return { status: "error", message: "Die Einladung konnte nicht angenommen werden." };
  }
}

/**
 * Ends the connection from the client side. The client keeps every row they
 * created; the counselor loses read access immediately because
 * `client_link_grants_access` only matches active links.
 */
export async function revokeClientLinkAsClientAction(
  input: { linkId: string },
): Promise<ClientModeActionResult> {
  try {
    const supabase = await createClient();
    const user = await getVerifiedUser(supabase);

    if (!user) {
      return { status: "error", message: "Bitte melde dich an." };
    }

    const service = await createServiceClient();
    const now = new Date().toISOString();
    const { error } = await service
      .from("client_links")
      .update({ status: "revoked", revoked_at: now, updated_at: now })
      .eq("id", input.linkId)
      .eq("client_user_id", user.id);

    if (error) {
      return { status: "error", message: "Die Verbindung konnte nicht beendet werden." };
    }

    revalidatePath("/klient/betreuung");
    return { status: "success", message: "Verbindung beendet." };
  } catch (error) {
    console.error("Failed to revoke client link:", error);
    return { status: "error", message: "Die Verbindung konnte nicht beendet werden." };
  }
}

/**
 * Turns the check-in area of an existing link on or off.
 *
 * The one consent area with a switch of its own, because it is the one whose
 * content is not a list of foods. Off means the counselor sees nothing from
 * the check-in regardless of the per-metric switches in the settings — those
 * can only narrow this, never widen it.
 */
export async function setClientWellbeingConsentAction(
  input: { linkId: string; consent: boolean },
): Promise<ClientModeActionResult> {
  try {
    const supabase = await createClient();
    const user = await getVerifiedUser(supabase);

    if (!user) {
      return { status: "error", message: "Bitte melde dich an." };
    }

    const service = await createServiceClient();
    const { error } = await service
      .from("client_links")
      .update({ consent_wellbeing: input.consent, updated_at: new Date().toISOString() })
      // Scoped to the caller's own link: a client may only change their own.
      .eq("id", input.linkId)
      .eq("client_user_id", user.id)
      .eq("status", "active");

    if (error) {
      return { status: "error", message: "Die Freigabe konnte nicht geändert werden." };
    }

    revalidatePath("/klient/betreuung");
    return {
      status: "success",
      message: input.consent ? "Befinden freigegeben." : "Freigabe zurückgezogen.",
    };
  } catch (error) {
    console.error("Failed to update wellbeing consent:", error);
    return { status: "error", message: "Die Freigabe konnte nicht geändert werden." };
  }
}
