import { NextResponse } from "next/server";

import type { ReportExportRequest } from "@/lib/types";
import { createClient } from "@/lib/supabase/server";
import { toCsv } from "@/lib/exports/csv";
import { renderReportPdfBuffer } from "@/lib/exports/pdf";
import { buildFileResponse, createExportJob } from "@/lib/exports/server";

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

  return toCsv(rows);
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const body = (await request.json()) as ReportExportRequest;

  if (!body?.title || !body?.fileBaseName) {
    return NextResponse.json({ error: "INVALID_EXPORT_REQUEST" }, { status: 400 });
  }

  const { data: authData } = await supabase.auth.getUser();
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
  return buildFileResponse(csv, {
    contentType: "text/csv;charset=utf-8",
    fileName,
  });
}
