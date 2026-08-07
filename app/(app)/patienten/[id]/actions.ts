"use server";

import { randomInt } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { INVITE_CODE_ALPHABET, INVITE_CODE_LENGTH } from "@/lib/client-mode";
import { CLIENT_LINK_COLUMNS, mapClientLinkRow, type ClientLinkRow } from "@/lib/data/client-links";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import type { ClientLink } from "@/lib/types";

const INVITE_VALID_DAYS = 14;

export interface ClientInviteActionResult {
  status: "success" | "error";
  message: string | null;
  link?: ClientLink;
}

function generateInviteCode(): string {
  let code = "";
  for (let index = 0; index < INVITE_CODE_LENGTH; index += 1) {
    code += INVITE_CODE_ALPHABET[randomInt(INVITE_CODE_ALPHABET.length)];
  }
  return code;
}

const inviteSchema = z.object({
  patientId: z.string().uuid("Patient nicht gefunden."),
});

/**
 * Creates the invite a patient uses to connect their own account.
 *
 * Patient ownership is checked through the RLS-scoped client, so a counselor
 * can only invite for their own records. The insert then runs with the
 * service-role client because `client_links` has no write policy — see the
 * migration for why writes are server-side only.
 */
export async function createClientInviteAction(
  input: { patientId: string },
): Promise<ClientInviteActionResult> {
  const parsed = inviteSchema.safeParse(input);
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Ungültige Eingabe." };
  }

  const { patientId } = parsed.data;

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { status: "error", message: "Nicht angemeldet." };
    }

    const { data: patient, error: patientError } = await supabase
      .from("patients")
      .select("id")
      .eq("id", patientId)
      .maybeSingle();

    if (patientError || !patient) {
      return { status: "error", message: "Patient nicht gefunden." };
    }

    const service = await createServiceClient();

    // An open or active link already covers this patient (unique index).
    const { data: existing } = await service
      .from("client_links")
      .select(CLIENT_LINK_COLUMNS)
      .eq("patient_id", patientId)
      .neq("status", "revoked")
      .maybeSingle();

    if (existing) {
      const link = mapClientLinkRow(existing as unknown as ClientLinkRow);
      return {
        status: "error",
        message:
          link.status === "active"
            ? "Dieser Patient ist bereits mit einem Klienten-Konto verbunden."
            : "Für diesen Patienten ist bereits eine Einladung offen.",
        link,
      };
    }

    const expiresAt = new Date(Date.now() + INVITE_VALID_DAYS * 24 * 60 * 60 * 1000).toISOString();

    // A code collision is astronomically unlikely but cheap to survive.
    let lastError: string | null = null;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const { data, error } = await service
        .from("client_links")
        .insert({
          patient_id: patientId,
          counselor_user_id: user.id,
          invite_code: generateInviteCode(),
          invite_expires_at: expiresAt,
          status: "invited",
        })
        .select(CLIENT_LINK_COLUMNS)
        .single();

      if (!error && data) {
        revalidatePath(`/patienten/${patientId}`);
        return {
          status: "success",
          message: null,
          link: mapClientLinkRow(data as unknown as ClientLinkRow),
        };
      }

      lastError = error?.message ?? "Unbekannter Fehler";
      if (!error?.message.includes("invite_code")) break;
    }

    console.error("Failed to create client invite:", lastError);
    return { status: "error", message: "Die Einladung konnte nicht erstellt werden." };
  } catch (error) {
    console.error("Failed to create client invite:", error);
    return { status: "error", message: "Die Einladung konnte nicht erstellt werden." };
  }
}

/** Ends the connection from the counselor side. Client data stays with the client. */
export async function revokeClientLinkAction(
  input: { linkId: string; patientId: string },
): Promise<ClientInviteActionResult> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { status: "error", message: "Nicht angemeldet." };
    }

    const service = await createServiceClient();
    const now = new Date().toISOString();
    const { error } = await service
      .from("client_links")
      .update({ status: "revoked", revoked_at: now, updated_at: now })
      .eq("id", input.linkId)
      .eq("counselor_user_id", user.id);

    if (error) {
      return { status: "error", message: "Die Verbindung konnte nicht beendet werden." };
    }

    revalidatePath(`/patienten/${input.patientId}`);
    return { status: "success", message: "Verbindung beendet." };
  } catch (error) {
    console.error("Failed to revoke client link:", error);
    return { status: "error", message: "Die Verbindung konnte nicht beendet werden." };
  }
}
