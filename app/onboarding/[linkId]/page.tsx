import { createServiceClient } from "@/lib/supabase/server";
import { PatientIntakeForm } from "./patient-intake-form";

export const dynamic = "force-dynamic";

interface OnboardingPageProps {
  params: Promise<{ linkId: string }>;
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function GuardScreen({ title, message }: { title: string; message: string }) {
  return (
    <div className="py-16 text-center">
      <h1 className="text-2xl font-bold">{title}</h1>
      <p className="mt-2 text-muted-foreground">{message}</p>
    </div>
  );
}

export default async function OnboardingPage({ params }: OnboardingPageProps) {
  const { linkId } = await params;

  if (!UUID_REGEX.test(linkId)) {
    return (
      <GuardScreen
        title="Link nicht gefunden"
        message="Der angegebene Einladungslink ist ungültig."
      />
    );
  }

  const supabase = await createServiceClient();

  const { data: link, error } = await supabase
    .from("patient_intake_links")
    .select("id, status, expires_at")
    .eq("id", linkId)
    .single();

  if (error || !link) {
    return (
      <GuardScreen
        title="Link nicht gefunden"
        message="Diese Einladung existiert nicht oder wurde gelöscht."
      />
    );
  }

  if (link.status === "received") {
    return (
      <GuardScreen
        title="Bereits ausgefüllt"
        message="Dieser Fragebogen wurde bereits ausgefüllt und übermittelt. Vielen Dank!"
      />
    );
  }

  if (link.expires_at && new Date(link.expires_at) < new Date()) {
    return (
      <GuardScreen
        title="Link abgelaufen"
        message="Diese Einladung ist leider abgelaufen. Bitte fordern Sie einen neuen Link bei Ihrer Ernährungsberatung an."
      />
    );
  }

  if (link.status !== "pending") {
    return (
      <GuardScreen
        title="Link nicht verfügbar"
        message="Diese Einladung ist nicht mehr aktiv."
      />
    );
  }

  return <PatientIntakeForm linkId={linkId} />;
}
