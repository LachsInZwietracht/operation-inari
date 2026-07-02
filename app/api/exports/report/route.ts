import { NextResponse } from "next/server";

import type { ReportExportRequest } from "@/lib/types";
import { createClient } from "@/lib/supabase/server";
import { toCsv } from "@/lib/exports/csv";
import { renderReportPdfBuffer } from "@/lib/exports/pdf";
import { buildFileResponse, createExportJob } from "@/lib/exports/server";
import { writeAccessAuditLog } from "@/lib/audit/access-audit";

function buildReportCsv(request: ReportExportRequest) {
  const rows: string[][] = [
    ["Titel", request.title],
    ["Plan", request.planDateLabel],
    ["Umfang", request.reportLength === "short" ? "Kurzbericht" : "Vollversion"],
    ["Abschnitte", request.activeSectionLabels.join(", ")],
    [],
    ["Bereich", "Nährstoff", "Istwert", "Referenz", "Abdeckung"],
  ];

  const sections = [
    ["Zusammenfassung", request.summaryMetrics],
    ["Nährstofftabelle", request.nutrientRows],
    ["Vitamine", request.vitaminRows],
    ["Mineralstoffe", request.mineralRows],
  ] as const;

  for (const [section, values] of sections) {
    for (const value of values) {
      rows.push([
        section,
        value.label,
        value.value,
        value.reference ?? "",
        value.coverage ?? "",
      ]);
    }
  }

  rows.push([]);
  rows.push(["Mahlzeit", "Zusammenfassung"]);
  for (const mealRow of request.mealRows) {
    rows.push([mealRow.slot, mealRow.summary]);
  }

  if (request.notes) {
    rows.push([]);
    rows.push(["Hinweise", request.notes]);
  }

  if (request.lmivRows?.length) {
    rows.push([]);
    rows.push(["LMIV", "Nährstoff", "pro Portion", "pro 100 g", ""]);
    for (const row of request.lmivRows) {
      rows.push(["LMIV", row.label, row.value, row.reference ?? "", ""]);
    }
    rows.push(["Deklaration", "Allergene", request.allergenDeclaration?.join(", ") ?? "", "", ""]);
    rows.push(["Deklaration", "Zusatzstoffe", request.additiveDeclaration?.join(", ") ?? "", "", ""]);
  }

  if (request.retentionPolicyLabel) {
    rows.push([]);
    rows.push(["Archivierung", request.retentionPolicyLabel]);
  }

  return toCsv(rows);
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const body = (await request.json()) as ReportExportRequest;

  if (!body?.title || !body?.fileBaseName) {
    return NextResponse.json({ error: "INVALID_EXPORT_REQUEST" }, { status: 400 });
  }

  const { data: authData } = await supabase.auth.getUser();
  const userId = authData.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  }

  const createdBy = authData.user?.email ?? "Unbekannt";

  if (body.format === "PDF") {
    const pdfBuffer = await renderReportPdfBuffer(body);
    const fileName = `${body.fileBaseName}.pdf`;
    await createExportJob(supabase, {
      format: "PDF",
      scope: "Berichte",
      createdBy,
      fileName,
      sizeBytes: pdfBuffer.length,
      parameters: {
        planDateLabel: body.planDateLabel,
        reportLength: body.reportLength,
        sections: body.activeSectionLabels,
      },
    });
    await writeAccessAuditLog(supabase, {
      action: "report_export_created",
      targetType: "report_export",
      targetId: body.planId,
      metadata: {
        format: "PDF",
        disposition: body.disposition ?? "attachment",
        patientId: body.patientId,
        planId: body.planId,
        protocolId: body.protocolId,
        reportLength: body.reportLength,
        sectionCount: body.activeSectionLabels.length,
        fileName,
        sizeBytes: pdfBuffer.length,
      },
    });
    return buildFileResponse(pdfBuffer, {
      contentType: "application/pdf",
      fileName,
      disposition: body.disposition,
    });
  }

  const csv = buildReportCsv(body);
  const fileName = `${body.fileBaseName}.csv`;
  await createExportJob(supabase, {
    format: "CSV",
    scope: "Berichte",
    createdBy,
    fileName,
    sizeBytes: Buffer.byteLength(csv, "utf8"),
    parameters: {
      planDateLabel: body.planDateLabel,
      reportLength: body.reportLength,
      sections: body.activeSectionLabels,
    },
  });
  await writeAccessAuditLog(supabase, {
    action: "report_export_created",
    targetType: "report_export",
    targetId: body.planId,
    metadata: {
      format: "CSV",
      disposition: body.disposition ?? "attachment",
      patientId: body.patientId,
      planId: body.planId,
      protocolId: body.protocolId,
      reportLength: body.reportLength,
      sectionCount: body.activeSectionLabels.length,
      fileName,
      sizeBytes: Buffer.byteLength(csv, "utf8"),
    },
  });
  return buildFileResponse(csv, {
    contentType: "text/csv;charset=utf-8",
    fileName,
  });
}
