import { NextResponse } from "next/server";

import type { PatientMailMergeExportRequest } from "@/lib/types";
import { createClient } from "@/lib/supabase/server";
import { renderMailMergePdfBuffer } from "@/lib/exports/pdf";
import { buildFileResponse, createExportJob } from "@/lib/exports/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const body = (await request.json()) as PatientMailMergeExportRequest;

  if (!body?.documents?.length || !body?.fileBaseName) {
    return NextResponse.json({ error: "INVALID_MAIL_MERGE_REQUEST" }, { status: 400 });
  }

  const pdfBuffer = await renderMailMergePdfBuffer(body);
  const { data: authData } = await supabase.auth.getUser();
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

  return buildFileResponse(pdfBuffer, {
    contentType: "application/pdf",
    fileName,
  });
}
