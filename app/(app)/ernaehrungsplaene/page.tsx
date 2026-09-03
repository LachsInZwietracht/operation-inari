import { redirect } from "next/navigation";

export default async function ErnaehrungsplaenePage({
  searchParams,
}: {
  searchParams: Promise<{ patientId?: string; indication?: string; returnDate?: string; scope?: string }>;
}) {
  const query = await searchParams;
  const params = new URLSearchParams();
  if (query.patientId) params.set("patientId", query.patientId);
  if (query.indication) params.set("indication", query.indication);
  if (query.returnDate) params.set("returnDate", query.returnDate);
  if (query.scope === "patient" || query.scope === "general") {
    params.set("scope", query.scope);
  }
  const suffix = params.toString();

  redirect(`/ernaehrungsplan/bibliothek${suffix ? `?${suffix}` : ""}`);
}
