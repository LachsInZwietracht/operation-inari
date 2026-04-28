import { PatientDetailClient } from "./patient-detail-client"
import { fetchPatientWorkspaceData } from "@/lib/data/patient-workspace"

export default async function PatientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const initialData = await fetchPatientWorkspaceData(id)

  return <PatientDetailClient patientId={id} initialData={initialData} />
}
