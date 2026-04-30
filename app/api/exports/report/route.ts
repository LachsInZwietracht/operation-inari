import { NextResponse } from "next/server";

import type { ReportExportRequest } from "@/lib/types";
import { createClient } from "@/lib/supabase/server";
import { toCsv } from "@/lib/exports/csv";
import { renderReportPdfBuffer } from "@/lib/exports/pdf";
import { buildFileResponse, createExportJob } from "@/lib/exports/server";
import {
  PATIENT_REPORT_FILES_BUCKET,
  persistPatientReportRecord,
  persistPatientReportVersion,
} from "@/lib/data/patient-reports-client";

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
  const shouldPersistPatientReport =
    body.disposition !== "inline" &&
    Boolean(body.patientId && body.planId && body.patientName);
  let patientReportId: string | undefined;
  let patientReportVersionId: string | undefined;

  async function persistPatientReport(
    format: "PDF" | "CSV",
    fileName: string,
    payload: Buffer | string,
    contentType: string,
  ) {
    if (!shouldPersistPatientReport || !body.patientId || !body.planId || !body.patientName || !userId) {
      return;
    }

    const report = await persistPatientReportRecord(
      {
        id: body.reportId,
        patientRef: body.patientId,
        patientName: body.patientName,
        patientIndication: body.patientIndication,
        title: body.title,
        planId: body.planId,
        protocolId: body.protocolId,
        planDateLabel: body.planDateLabel,
        reportLength: body.reportLength,
        selectedSections: body.selectedSections,
        activeSectionLabels: body.activeSectionLabels,
        notes: body.notes,
        lastFormat: format,
        lastFileName: fileName,
      },
      supabase,
    );
    patientReportId = report.id;

    const storagePath = [
      userId,
      body.patientId,
      report.id,
      `${new Date().toISOString().replace(/[:.]/g, "-")}-${format.toLowerCase()}-${crypto.randomUUID()}.${format === "PDF" ? "pdf" : "csv"}`,
    ].join("/");

    const { error: uploadError } = await supabase.storage
      .from(PATIENT_REPORT_FILES_BUCKET)
      .upload(storagePath, payload, {
        contentType,
        upsert: false,
      });

    if (uploadError) {
      throw new Error(uploadError.message);
    }

    try {
      const version = await persistPatientReportVersion(
        {
          patientReportId: report.id,
          patientRef: body.patientId,
          patientName: body.patientName,
          patientIndication: body.patientIndication,
          title: body.title,
          planId: body.planId,
          protocolId: body.protocolId,
          format,
          fileName,
          fileSize: typeof payload === "string" ? Buffer.byteLength(payload, "utf8") : payload.length,
          contentType,
          storagePath,
          snapshot: {
            ...body,
            format,
          },
        },
        supabase,
      );
      patientReportVersionId = version.id;
    } catch (error) {
      await supabase.storage.from(PATIENT_REPORT_FILES_BUCKET).remove([storagePath]);
      throw error;
    }
  }

  if (body.format === "PDF") {
    const pdfBuffer = await renderReportPdfBuffer(body);
    const fileName = `${body.fileBaseName}.pdf`;
    await persistPatientReport("PDF", fileName, pdfBuffer, "application/pdf");
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
      headers: {
        ...(patientReportId
          ? {
              "x-inari-patient-report-id": patientReportId,
              "x-prodi-patient-report-id": patientReportId,
            }
          : {}),
        ...(patientReportVersionId
          ? {
              "x-inari-patient-report-version-id": patientReportVersionId,
              "x-prodi-patient-report-version-id": patientReportVersionId,
            }
          : {}),
      },
    });
  }

  const csv = buildReportCsv(body);
  const fileName = `${body.fileBaseName}.csv`;
  await persistPatientReport("CSV", fileName, csv, "text/csv;charset=utf-8");
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
    headers: {
      ...(patientReportId
        ? {
            "x-inari-patient-report-id": patientReportId,
            "x-prodi-patient-report-id": patientReportId,
          }
        : {}),
      ...(patientReportVersionId
        ? {
            "x-inari-patient-report-version-id": patientReportVersionId,
            "x-prodi-patient-report-version-id": patientReportVersionId,
          }
        : {}),
    },
  });
}
