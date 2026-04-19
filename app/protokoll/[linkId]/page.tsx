import { createServiceClient } from "@/lib/supabase/server";
import { PatientProtocolForm } from "./patient-protocol-form";

export const dynamic = "force-dynamic";

interface ProtokollPageProps {
  params: Promise<{ linkId: string }>;
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function ProtokollPage({ params }: ProtokollPageProps) {
  const { linkId } = await params;

  if (!UUID_REGEX.test(linkId)) {
    return (
      <div className="py-16 text-center">
        <h1 className="text-2xl font-bold">Link nicht gefunden</h1>
        <p className="mt-2 text-muted-foreground">
          Der angegebene Protokoll-Link ist ungültig.
        </p>
      </div>
    );
  }

  const supabase = await createServiceClient();

  const { data: link, error } = await supabase
    .from("patient_digital_protocol_links")
    .select("*")
    .eq("id", linkId)
    .single();

  if (error || !link) {
    return (
      <div className="py-16 text-center">
        <h1 className="text-2xl font-bold">Link nicht gefunden</h1>
        <p className="mt-2 text-muted-foreground">
          Dieser Protokoll-Link existiert nicht oder wurde gelöscht.
        </p>
      </div>
    );
  }

  // Check if already submitted (status changed to "received")
  if (link.status === "received") {
    return (
      <div className="py-16 text-center">
        <h1 className="text-2xl font-bold">Bereits eingereicht</h1>
        <p className="mt-2 text-muted-foreground">
          Dieses Ernährungsprotokoll wurde bereits ausgefüllt und eingereicht.
          Vielen Dank!
        </p>
      </div>
    );
  }

  // Check expiry
  if (link.expires_at && new Date(link.expires_at) < new Date()) {
    return (
      <div className="py-16 text-center">
        <h1 className="text-2xl font-bold">Link abgelaufen</h1>
        <p className="mt-2 text-muted-foreground">
          Dieser Protokoll-Link ist leider abgelaufen. Bitte kontaktieren Sie
          Ihre Ernährungsberatung für einen neuen Link.
        </p>
      </div>
    );
  }

  // Check status is pending
  if (link.status !== "pending") {
    return (
      <div className="py-16 text-center">
        <h1 className="text-2xl font-bold">Link nicht verfügbar</h1>
        <p className="mt-2 text-muted-foreground">
          Dieser Protokoll-Link ist nicht mehr aktiv.
        </p>
      </div>
    );
  }

  return (
    <PatientProtocolForm
      linkId={linkId}
      patientId={link.patient_id}
      method={link.method}
    />
  );
}
