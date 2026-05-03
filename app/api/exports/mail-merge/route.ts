import { NextResponse } from "next/server";

import type { PatientMailMergeExportRequest } from "@/lib/types";
import { createClient } from "@/lib/supabase/server";
import { renderMailMergePdfBuffer } from "@/lib/exports/pdf";
import { buildFileResponse, createExportJob } from "@/lib/exports/server";
import { writeAccessAuditLog } from "@/lib/audit/access-audit";

export async function POST(request: Request) {
  const supabase = await createClient();
  const body = (await request.json()) as PatientMailMergeExportRequest;

  if (!body?.documents?.length || !body?.fileBaseName) {
    return NextResponse.json({ error: "INVALID_MAIL_MERGE_REQUEST" }, { status: 400 });
  }

  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) {
    return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  }

  const pdfBuffer = await renderMailMergePdfBuffer(body);
  const fileName = `${body.fileBaseName}.pdf`;

  await createExportJob(supabase, {
    format: "PDF",
    scope: "Patienten",
    createdBy: authData.user?.email ?? "Unbekannt",
    fileName,
    sizeBytes: pdfBuffer.length,
    parameters: {
      documentCount: body.documents.length,
      title: body.title,
    },
  });

  await writeAccessAuditLog(supabase, {
    action: "patient_mail_merge_export_created",
    targetType: "patient_export",
    targetId: fileName,
    metadata: {
      format: "PDF",
      documentCount: body.documents.length,
      patientIds: body.documents.map((document) => document.patientId),
      title: body.title,
      fileName,
      sizeBytes: pdfBuffer.length,
    },
  });

  return buildFileResponse(pdfBuffer, {
    contentType: "application/pdf",
    fileName,
  });
}
