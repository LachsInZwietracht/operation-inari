import { NextResponse } from "next/server";

import type { GenericExportRequest } from "@/lib/types";
import { createClient } from "@/lib/supabase/server";
import { fetchFoods } from "@/lib/data/foods";
import { fetchMealPlans } from "@/lib/data/meal-plans";
import { fetchPatients } from "@/lib/data/patients";
import { fetchRecipes } from "@/lib/data/recipes";
import { buildDefaultReportExportRequest } from "@/lib/exports/report-builder";
import { isSupportedExport } from "@/lib/exports/constants";
import { toCsv } from "@/lib/exports/csv";
import { renderMailMergePdfBuffer, renderReportPdfBuffer } from "@/lib/exports/pdf";
import { buildFileResponse, createExportJob } from "@/lib/exports/server";

function serializeMealPlans(mealPlans: Awaited<ReturnType<typeof fetchMealPlans>>) {
  return mealPlans.map((plan) => ({
    id: plan.id,
    date: plan.date,
    slots: plan.slots.map((slot) => ({
      type: slot.type,
      entries: slot.entries.map((entry) => ({
        id: entry.id,
        type: entry.type,
        referenceId: entry.referenceId,
        amount: entry.amount,
      })),
    })),
  }));
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const body = (await request.json()) as GenericExportRequest;

  if (!body || !isSupportedExport(body.format, body.scope)) {
    return NextResponse.json({ error: "UNSUPPORTED_EXPORT" }, { status: 400 });
  }

  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) {
    return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  }
  const createdBy = authData.user.email ?? "Unbekannt";

  let payload: Buffer | string;
  let contentType = "application/octet-stream";
  let extension = body.format.toLowerCase();
  const baseName = `${body.scope.toLowerCase().replace(/\s+/g, "-")}-${new Date().toISOString().slice(0, 10)}`;

  if (body.scope === "Lebensmittel") {
    const foods = (await fetchFoods({ supabase, includeNutrients: false, includePortions: false, withCount: false })).foods;
    if (body.format === "JSON") {
      payload = JSON.stringify(foods, null, 2);
      contentType = "application/json";
    } else {
      payload = toCsv([
        ["ID", "Name", "Quelle", "Kategorie", "Hersteller"],
        ...foods.map((food) => [food.id, food.name, food.sourceId ?? "", food.categoryId ?? "", food.manufacturer ?? ""]),
      ]);
      contentType = "text/csv;charset=utf-8";
    }
  } else if (body.scope === "Rezepte") {
    const recipes = await fetchRecipes({ supabase });
    if (body.format === "JSON") {
      payload = JSON.stringify(recipes, null, 2);
      contentType = "application/json";
    } else {
      payload = toCsv([
        ["ID", "Name", "Kategorie", "Portionen", "Quelle"],
        ...recipes.map((recipe) => [
          recipe.id,
          recipe.name,
          recipe.category ?? "",
          String(recipe.servings),
          recipe.sourceType ?? "",
        ]),
      ]);
      contentType = "text/csv;charset=utf-8";
    }
  } else if (body.scope === "Patienten") {
    const patients = await fetchPatients(supabase);
    if (body.format === "PDF") {
      payload = await renderMailMergePdfBuffer({
        format: "PDF",
        title: "Patientenübersicht",
        fileBaseName: baseName,
        documents: patients.length > 0
          ? patients.map((patient) => ({
              patientId: patient.id,
              patientName: `${patient.firstName} ${patient.lastName}`,
              subject: `${patient.lastName}, ${patient.firstName}`,
              body: [
                `Geburtsdatum: ${patient.dateOfBirth}`,
                `Indikation: ${patient.indication ?? "-"}`,
                `E-Mail: ${patient.email ?? "-"}`,
                `Telefon: ${patient.phone ?? "-"}`,
                `Krankenkasse: ${patient.insuranceProvider ?? "-"}`,
              ].join("\n"),
            }))
          : [{
              patientId: "empty-patient-list",
              patientName: "Keine Patientendaten vorhanden",
              subject: "Patientenübersicht",
              body: "Für den aktuellen Benutzer sind noch keine Patientendaten gespeichert.",
            }],
      });
      contentType = "application/pdf";
    } else if (body.format === "JSON") {
      payload = JSON.stringify(patients, null, 2);
      contentType = "application/json";
    } else {
      payload = toCsv([
        ["ID", "Vorname", "Nachname", "Geburtsdatum", "Indikation", "E-Mail"],
        ...patients.map((patient) => [
          patient.id,
          patient.firstName,
          patient.lastName,
          patient.dateOfBirth,
          patient.indication ?? "",
          patient.email ?? "",
        ]),
      ]);
      contentType = "text/csv;charset=utf-8";
    }
  } else if (body.scope === "Ernährungspläne") {
    const mealPlans = await fetchMealPlans({ supabase, userId: authData.user.id, includeSystem: true });
    if (body.format === "JSON") {
      payload = JSON.stringify(serializeMealPlans(mealPlans), null, 2);
      contentType = "application/json";
    } else {
      payload = toCsv([
        ["ID", "Datum", "Mahlzeit", "Einträge"],
        ...mealPlans.flatMap((plan) =>
          plan.slots.map((slot) => [
            plan.id,
            plan.date,
            slot.type,
            slot.entries.map((entry) => `${entry.type}:${entry.referenceId}:${entry.amount}`).join(" | "),
          ]),
        ),
      ]);
      contentType = "text/csv;charset=utf-8";
    }
  } else {
    const mealPlans = await fetchMealPlans({ supabase, userId: authData.user.id, includeSystem: true, limit: 1 });
    const recipes = await fetchRecipes({ supabase });
    const foods = (await fetchFoods({ supabase, includePortions: true, withCount: false })).foods;
    const latestPlan = mealPlans[0];

    if (!latestPlan) {
      if (body.format === "PDF") {
        payload = await renderReportPdfBuffer({
          format: "PDF",
          title: "Bericht aus API & Export",
          fileBaseName: baseName,
          planDateLabel: "Kein Plan verfügbar",
          reportLength: "short",
          selectedSections: { summary: true, table: false, charts: false, meals: false, notes: true },
          activeSectionLabels: ["Kurzfazit & Indikatoren", "Individuelle Hinweise"],
          summaryMetrics: [{ label: "Status", value: "Kein Ernährungsplan vorhanden" }],
          nutrientRows: [],
          vitaminRows: [],
          mineralRows: [],
          mealRows: [],
          notes: "Für den aktuellen Benutzer ist noch kein Ernährungsplan vorhanden.",
          badges: ["API Export"],
        });
        contentType = "application/pdf";
      } else {
        payload = toCsv([
          ["Titel", "Bericht aus API & Export"],
          ["Status", "Kein Ernährungsplan vorhanden"],
        ]);
        contentType = "text/csv;charset=utf-8";
      }
    } else {
      const reportRequest = buildDefaultReportExportRequest(latestPlan, recipes, foods);
      if (body.format === "PDF") {
        payload = await renderReportPdfBuffer(reportRequest);
        contentType = "application/pdf";
      } else {
        payload = toCsv([
          ["Titel", reportRequest.title],
          ["Plan", reportRequest.planDateLabel],
          [],
          ["Nährstoff", "Istwert", "Referenz", "Abdeckung"],
          ...reportRequest.nutrientRows.map((row) => [row.label, row.value, row.reference ?? "", row.coverage ?? ""]),
        ]);
        contentType = "text/csv;charset=utf-8";
      }
    }
  }

  if (body.format === "JSON") extension = "json";
  if (body.format === "CSV") extension = "csv";
  if (body.format === "PDF") extension = "pdf";

  const sizeBytes = typeof payload === "string" ? Buffer.byteLength(payload, "utf8") : payload.length;
  const fileName = `${baseName}.${extension}`;

  await createExportJob(supabase, {
    format: body.format,
    scope: body.scope,
    createdBy,
    fileName,
    sizeBytes,
    parameters: { scope: body.scope, format: body.format },
  });

  return buildFileResponse(payload, {
    contentType,
    fileName,
  });
}
