import { NextResponse } from "next/server"

import { buildFileResponse } from "@/lib/exports/server"
import { fetchPatientReportVersionByIdClient } from "@/lib/data/patient-reports-client"
import { createClient } from "@/lib/supabase/server"

interface RouteContext {
  params: Promise<{
    versionId: string
  }>
}

async function loadVersion(versionId: string) {
  const supabase = await createClient()
  const version = await fetchPatientReportVersionByIdClient(versionId, supabase)

  if (!version) {
    return { supabase, version: null }
  }

  return { supabase, version }
}

export async function HEAD(_request: Request, context: RouteContext) {
  const { versionId } = await context.params
  const { supabase, version } = await loadVersion(versionId)

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
  const { supabase, version } = await loadVersion(versionId)

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

  return buildFileResponse(payload, {
    contentType: version.contentType,
    fileName: version.fileName,
  })
}
