import { NextResponse } from "next/server"

import { buildFileResponse } from "@/lib/exports/server"
import { fetchPatientReportVersionByIdClient } from "@/lib/data/patient-reports-client"
import { createClient } from "@/lib/supabase/server"
import { writeAccessAuditLog } from "@/lib/audit/access-audit"

interface RouteContext {
  params: Promise<{
    versionId: string
  }>
}

async function loadVersion(versionId: string) {
  const supabase = await createClient()
  const { data: authData, error: authError } = await supabase.auth.getUser()

  if (authError) {
    throw new Error(authError.message)
  }

  if (!authData.user) {
    return { supabase, version: null, authRequired: true }
  }

  const version = await fetchPatientReportVersionByIdClient(versionId, supabase)

  if (!version) {
    return { supabase, version: null, authRequired: false }
  }

  return { supabase, version, authRequired: false }
}

export async function HEAD(_request: Request, context: RouteContext) {
  const { versionId } = await context.params
  const { supabase, version, authRequired } = await loadVersion(versionId)

  if (authRequired) {
    return new Response(null, { status: 401 })
  }

  if (!version) {
    return new Response(null, { status: 404 })
  }

  const { error } = await supabase.storage
    .from(version.storageBucket)
    .download(version.storagePath)

  return new Response(null, { status: error ? 404 : 200 })
}

export async function GET(_request: Request, context: RouteContext) {
  const { versionId } = await context.params
  const { supabase, version, authRequired } = await loadVersion(versionId)

  if (authRequired) {
    return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 })
  }

  if (!version) {
    return NextResponse.json({ error: "PATIENT_REPORT_VERSION_NOT_FOUND" }, { status: 404 })
  }

  const { data, error } = await supabase.storage
    .from(version.storageBucket)
    .download(version.storagePath)

  if (error || !data) {
    return NextResponse.json({ error: "PATIENT_REPORT_FILE_NOT_FOUND" }, { status: 404 })
  }

  const payload = Buffer.from(await data.arrayBuffer())

  await writeAccessAuditLog(supabase, {
    action: "patient_report_version_downloaded",
    targetType: "patient_report_version",
    targetId: version.id,
    metadata: {
      patientId: version.patientRef,
      patientReportId: version.patientReportId,
      format: version.format,
      fileName: version.fileName,
      storageBucket: version.storageBucket,
      fileSize: version.fileSize,
    },
  })

  return buildFileResponse(payload, {
    contentType: version.contentType,
    fileName: version.fileName,
  })
}
