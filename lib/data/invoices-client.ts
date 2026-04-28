import type { SupabaseClient } from "@supabase/supabase-js";

import type { InvoiceEntry } from "@/lib/types";
import { createClient as createBrowserSupabaseClient } from "@/lib/supabase/client";
import { withTimeout } from "@/lib/data/utils";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value: string): boolean {
  return UUID_REGEX.test(value);
}

interface InvoiceRow {
  id: string;
  legacy_id: string | null;
  user_id: string;
  patient_id: string;
  appointment_id: string | null;
  service: string;
  amount: string; // NUMERIC comes back as string
  status: InvoiceEntry["status"];
  due_date: string;
  insurance: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

const INVOICE_COLUMNS = [
  "id",
  "legacy_id",
  "user_id",
  "patient_id",
  "appointment_id",
  "service",
  "amount",
  "status",
  "due_date",
  "insurance",
  "notes",
  "created_at",
  "updated_at",
].join(",");

function resolveBrowserClient(supabase?: SupabaseClient) {
  if (supabase) return supabase;
  return createBrowserSupabaseClient();
}

async function getAuthenticatedUserId(client: SupabaseClient) {
  const { data, error } = await client.auth.getUser();
  if (error) {
    throw new Error(error.message);
  }
  return data.user?.id ?? null;
}

function mapInvoiceRow(row: InvoiceRow): InvoiceEntry {
  return {
    id: row.id,
    legacyId: row.legacy_id ?? undefined,
    patientId: row.patient_id,
    appointmentId: row.appointment_id ?? undefined,
    service: row.service,
    amount: Number(row.amount),
    status: row.status,
    dueDate: row.due_date,
    insurance: row.insurance ?? undefined,
    notes: row.notes ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function fetchInvoicesClient(
  supabase?: SupabaseClient,
  options: { patientRefs?: string[] } = {},
): Promise<InvoiceEntry[]> {
  const client = resolveBrowserClient(supabase);
  let query = client.from("invoices").select(INVOICE_COLUMNS).order("due_date", { ascending: true });

  const patientRefs = options.patientRefs?.filter(Boolean);
  if (patientRefs?.length) {
    query = query.in("patient_id", patientRefs);
  }

  const { data, error } = await withTimeout(
    query,
    5000,
    "Supabase invoice request timed out",
  );

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as unknown as InvoiceRow[]).map((row) => mapInvoiceRow(row));
}

export async function persistInvoice(
  invoice: Partial<InvoiceEntry> & { patientId: string; service: string; amount: number; dueDate: string; status: InvoiceEntry["status"] },
  supabase?: SupabaseClient,
): Promise<InvoiceEntry> {
  const client = resolveBrowserClient(supabase);
  const userId = await getAuthenticatedUserId(client);

  if (!userId) {
    throw new Error("AUTH_REQUIRED");
  }

  const canonicalId = invoice.id && isUuid(invoice.id) ? invoice.id : null;
  const legacyId = canonicalId ? invoice.legacyId ?? null : invoice.id ?? null;

  const { data: persistedInvoice, error } = await client
    .from("invoices")
    .upsert(
      {
        ...(canonicalId ? { id: canonicalId } : {}),
        legacy_id: legacyId,
        user_id: userId,
        patient_id: invoice.patientId,
        appointment_id: invoice.appointmentId ?? null,
        service: invoice.service,
        amount: invoice.amount,
        status: invoice.status,
        due_date: invoice.dueDate,
        insurance: invoice.insurance ?? null,
        notes: invoice.notes ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: canonicalId ? "id" : "legacy_id" },
    )
    .select(INVOICE_COLUMNS)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return mapInvoiceRow(persistedInvoice as unknown as InvoiceRow);
}

export async function deleteInvoiceClient(
  invoiceId: string,
  supabase?: SupabaseClient,
): Promise<void> {
  const client = resolveBrowserClient(supabase);
  const column = isUuid(invoiceId) ? "id" : "legacy_id";
  const { error } = await client
    .from("invoices")
    .delete()
    .eq(column, invoiceId);

  if (error) {
    throw new Error(error.message);
  }
}
