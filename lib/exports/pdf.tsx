import React from "react";
import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer";

import type {
  PatientMailMergeExportRequest,
  ReportExportDayPage,
  ReportExportEnergyBar,
  ReportExportPatientProfile,
  ReportExportRecipeCard,
  ReportExportRequest,
} from "@/lib/types";

const styles = StyleSheet.create({
  page: {
    paddingTop: 28,
    paddingBottom: 32,
    paddingHorizontal: 30,
    fontSize: 10,
    fontFamily: "Helvetica",
    color: "#1f2937",
  },
  header: {
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#d1d5db",
    paddingBottom: 10,
  },
  brand: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    color: "#0f766e",
  },
  subtitle: {
    marginTop: 4,
    fontSize: 9,
    color: "#4b5563",
  },
  h1: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    marginBottom: 4,
  },
  h2: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    marginBottom: 6,
  },
  section: {
    marginBottom: 14,
  },
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 8,
  },
  badge: {
    paddingVertical: 3,
    paddingHorizontal: 6,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 999,
    fontSize: 8,
  },
  metricRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 3,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  metricLabel: {
    width: "42%",
    fontFamily: "Helvetica-Bold",
  },
  metricValue: {
    width: "19%",
    textAlign: "right",
  },
  body: {
    fontSize: 10,
    lineHeight: 1.5,
  },
  listItem: {
    marginBottom: 3,
  },
  footer: {
    position: "absolute",
    bottom: 16,
    left: 30,
    right: 30,
    fontSize: 8,
    color: "#6b7280",
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    paddingTop: 6,
  },
  subtle: {
    fontSize: 8,
    color: "#6b7280",
  },
  profileBox: {
    marginBottom: 14,
    padding: 10,
    borderWidth: 1,
    borderColor: "#99f6e4",
    borderRadius: 6,
    backgroundColor: "#f0fdfa",
  },
  profileRow: {
    flexDirection: "row",
    marginBottom: 3,
  },
  profileLabel: {
    width: "32%",
    fontFamily: "Helvetica-Bold",
  },
  profileValue: {
    width: "68%",
  },
  allergyBox: {
    marginTop: 6,
    padding: 6,
    borderWidth: 1,
    borderColor: "#fecaca",
    borderRadius: 4,
    backgroundColor: "#fef2f2",
    color: "#991b1b",
  },
  mealBlock: {
    marginBottom: 10,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  mealHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 3,
  },
  mealSlot: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
  },
  barTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: "#e5e7eb",
  },
  barFill: {
    height: 8,
    borderRadius: 4,
    backgroundColor: "#0f766e",
  },
  recipeCard: {
    marginBottom: 14,
    padding: 10,
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 6,
  },
  recipeSectionTitle: {
    marginTop: 6,
    marginBottom: 3,
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
  },
});

function PdfHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <View style={styles.header}>
      <Text style={styles.brand}>Inari</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
      <Text style={[styles.h1, { marginTop: 10 }]}>{title}</Text>
    </View>
  );
}

function MetricTable({
  title,
  rows,
}: {
  title: string;
  rows: Array<{ label: string; value: string; reference?: string; coverage?: string }>;
}) {
  if (rows.length === 0) return null;
  return (
    <View style={styles.section}>
      <Text style={styles.h2}>{title}</Text>
      {rows.map((row) => (
        <View style={styles.metricRow} key={`${title}-${row.label}`}>
          <Text style={styles.metricLabel}>{row.label}</Text>
          <Text style={styles.metricValue}>{row.value}</Text>
          <Text style={styles.metricValue}>{row.reference ?? "-"}</Text>
          <Text style={styles.metricValue}>{row.coverage ?? "-"}</Text>
        </View>
      ))}
    </View>
  );
}

function PatientProfileBlock({ profile }: { profile: ReportExportPatientProfile }) {
  const rows: Array<[string, string] | null> = [
    profile.calorieGoalLabel ? ["Kalorienziel", profile.calorieGoalLabel] : null,
    profile.macroLabel ? ["Makroverteilung", profile.macroLabel] : null,
    profile.preferences?.length ? ["Ernährungsweise", profile.preferences.join(", ")] : null,
    profile.goals ? ["Ziele", profile.goals] : null,
  ];
  const visibleRows = rows.filter((row): row is [string, string] => row !== null);

  return (
    <View style={styles.profileBox}>
      <Text style={styles.h2}>Ihr Plan im Überblick</Text>
      <View style={styles.profileRow}>
        <Text style={styles.profileLabel}>Zeitraum</Text>
        <Text style={styles.profileValue}>{profile.periodLabel}</Text>
      </View>
      {visibleRows.map(([label, value]) => (
        <View style={styles.profileRow} key={label}>
          <Text style={styles.profileLabel}>{label}</Text>
          <Text style={styles.profileValue}>{value}</Text>
        </View>
      ))}
      {profile.allergies?.length ? (
        <View style={styles.allergyBox}>
          <Text style={{ fontFamily: "Helvetica-Bold" }}>
            Allergien & Unverträglichkeiten
          </Text>
          <Text>{profile.allergies.join(", ")}</Text>
        </View>
      ) : null}
    </View>
  );
}

function EnergyBarRow({ bar }: { bar: ReportExportEnergyBar }) {
  const ratio = bar.target > 0 ? Math.min(1, bar.value / bar.target) : 0;
  return (
    <View style={{ marginBottom: 10 }}>
      <View style={styles.mealHeader}>
        <Text style={styles.mealSlot}>Tagesbilanz Energie</Text>
        <Text>{bar.label}</Text>
      </View>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${Math.round(ratio * 100)}%` }]} />
      </View>
    </View>
  );
}

function DayPageContent({ day }: { day: ReportExportDayPage }) {
  return (
    <>
      <View style={styles.section}>
        {day.meals.map((meal) => (
          <View style={styles.mealBlock} key={meal.slot}>
            <View style={styles.mealHeader}>
              <Text style={styles.mealSlot}>{meal.slot}</Text>
              {meal.kcal ? <Text style={styles.subtle}>{meal.kcal}</Text> : null}
            </View>
            {meal.items.map((item, index) => (
              <Text key={index} style={styles.listItem}>
                {item}
              </Text>
            ))}
          </View>
        ))}
      </View>

      {day.energyBar ? <EnergyBarRow bar={day.energyBar} /> : null}
      {day.macroSummary ? (
        <Text style={[styles.subtle, { marginBottom: 12 }]}>{day.macroSummary}</Text>
      ) : null}

      {day.nutrientRows?.length ? (
        <MetricTable title="Nährstofftabelle" rows={day.nutrientRows} />
      ) : null}
      {day.vitaminRows?.length ? <MetricTable title="Vitamine" rows={day.vitaminRows} /> : null}
      {day.mineralRows?.length ? (
        <MetricTable title="Mineralstoffe" rows={day.mineralRows} />
      ) : null}
    </>
  );
}

function RecipeCard({ card }: { card: ReportExportRecipeCard }) {
  const metaLine = [card.plannedForLabel, card.kcalPerPortion, card.timeLabel]
    .filter(Boolean)
    .join(" · ");
  return (
    <View style={styles.recipeCard}>
      <Text style={styles.h2}>{card.name}</Text>
      {metaLine ? <Text style={[styles.subtle, { marginBottom: 4 }]}>{metaLine}</Text> : null}
      <Text style={styles.recipeSectionTitle}>{card.portionLabel}</Text>
      {card.ingredients.map((ingredient, index) => (
        <Text key={index} style={styles.listItem}>
          {ingredient}
        </Text>
      ))}
      {card.instructions.length > 0 ? (
        <>
          <Text style={styles.recipeSectionTitle}>Zubereitung</Text>
          {card.instructions.map((step, index) => (
            <Text key={index} style={styles.listItem}>
              {index + 1}. {step}
            </Text>
          ))}
        </>
      ) : null}
    </View>
  );
}

function PdfFooter() {
  return (
    <Text style={styles.footer} fixed>
      Inari · generiert am {new Date().toLocaleDateString("de-DE")}
    </Text>
  );
}

/**
 * Multi-day layout: optional cover with the patient profile, one page per
 * selected day, and a deduplicated recipe appendix. Single-day exports fold
 * the cover content into the day page.
 */
function MultiDayReportPdfDocument({ request }: { request: ReportExportRequest }) {
  const days = request.dayPages ?? [];
  const hasCover = days.length > 1;

  const coverContent = (
    <>
      {request.badges && request.badges.length > 0 ? (
        <View style={[styles.badgeRow, { marginBottom: 12 }]}>
          {request.badges.map((badge) => (
            <Text key={badge} style={styles.badge}>
              {badge}
            </Text>
          ))}
        </View>
      ) : null}

      {request.patientProfile ? <PatientProfileBlock profile={request.patientProfile} /> : null}

      {request.selectedSections.summary && request.summaryMetrics.length > 0 ? (
        <MetricTable title="Überblick" rows={request.summaryMetrics} />
      ) : null}

      {request.narrative ? (
        <View style={styles.section}>
          <Text style={styles.body}>{request.narrative}</Text>
        </View>
      ) : null}
    </>
  );

  const notesContent = (
    <>
      {request.selectedSections.notes && request.notes ? (
        <View style={styles.section}>
          <Text style={styles.h2}>Individuelle Hinweise</Text>
          <Text style={styles.body}>{request.notes}</Text>
        </View>
      ) : null}
      {request.specialNotes && request.specialNotes.length > 0 ? (
        <View style={styles.section}>
          {request.specialNotes.map((note) => (
            <Text key={note} style={styles.listItem}>
              {note}
            </Text>
          ))}
        </View>
      ) : null}
    </>
  );

  return (
    <Document title={request.title} author="Inari">
      {hasCover ? (
        <Page size="A4" style={styles.page}>
          <PdfHeader title={request.title} subtitle={request.planDateLabel} />
          {coverContent}
          {notesContent}
          <PdfFooter />
        </Page>
      ) : null}

      {days.map((day) => (
        <Page key={day.dateLabel} size="A4" style={styles.page}>
          <PdfHeader title={day.dateLabel} subtitle={request.title} />
          {!hasCover ? coverContent : null}
          <DayPageContent day={day} />
          {!hasCover ? notesContent : null}
          <PdfFooter />
        </Page>
      ))}

      {request.recipeAppendix && request.recipeAppendix.length > 0 ? (
        <Page size="A4" style={styles.page}>
          <PdfHeader title="Rezepte" subtitle={request.title} />
          {request.recipeAppendix.map((card) => (
            <RecipeCard key={card.name} card={card} />
          ))}
          <PdfFooter />
        </Page>
      ) : null}
    </Document>
  );
}

function ReportPdfDocument({ request }: { request: ReportExportRequest }) {
  return (
    <Document title={request.title} author="Inari">
      <Page size="A4" style={styles.page}>
        <PdfHeader
          title={request.title}
          subtitle={`${request.planDateLabel} · ${request.reportLength === "short" ? "Kurzbericht" : "Vollversion"}`}
        />

        {request.badges && request.badges.length > 0 ? (
          <View style={styles.badgeRow}>
            {request.badges.map((badge) => (
              <Text key={badge} style={styles.badge}>{badge}</Text>
            ))}
          </View>
        ) : null}

        {request.selectedSections.summary ? (
          <MetricTable title="Kurzfazit & Indikatoren" rows={request.summaryMetrics} />
        ) : null}

        {request.narrative ? (
          <View style={styles.section}>
            <Text style={styles.h2}>Automatische Bewertung</Text>
            <Text style={styles.body}>{request.narrative}</Text>
          </View>
        ) : null}

        {request.selectedSections.table ? (
          <>
            <MetricTable title="Nährstofftabelle" rows={request.nutrientRows} />
            <MetricTable title="Vitamine" rows={request.vitaminRows} />
            <MetricTable title="Mineralstoffe" rows={request.mineralRows} />
          </>
        ) : null}

        {request.selectedSections.meals ? (
          <View style={styles.section}>
            <Text style={styles.h2}>Speiseplanübersicht</Text>
            {request.mealRows.map((row) => (
              <Text key={row.slot} style={styles.listItem}>
                {row.slot}: {row.summary}
              </Text>
            ))}
          </View>
        ) : null}

        {request.selectedSections.notes && request.notes ? (
          <View style={styles.section}>
            <Text style={styles.h2}>Individuelle Hinweise</Text>
            <Text style={styles.body}>{request.notes}</Text>
          </View>
        ) : null}

        {request.lmivRows && request.lmivRows.length > 0 ? (
          <>
            <MetricTable title="LMIV Nährwertkennzeichnung" rows={request.lmivRows} />
            <View style={styles.section}>
              <Text style={styles.h2}>Allergen- und Zusatzstoffdeklaration</Text>
              <Text style={styles.listItem}>
                Allergene: {request.allergenDeclaration?.length ? request.allergenDeclaration.join(", ") : "keine Angabe"}
              </Text>
              <Text style={styles.listItem}>
                Zusatzstoffe: {request.additiveDeclaration?.length ? request.additiveDeclaration.join(", ") : "keine Angabe"}
              </Text>
            </View>
          </>
        ) : null}

        {request.specialNotes && request.specialNotes.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.h2}>Zusatzhinweise</Text>
            {request.specialNotes.map((note) => (
              <Text key={note} style={styles.listItem}>{note}</Text>
            ))}
          </View>
        ) : null}

        {request.retentionPolicyLabel ? (
          <View style={styles.section}>
            <Text style={styles.h2}>Archivierung</Text>
            <Text style={styles.body}>{request.retentionPolicyLabel}</Text>
          </View>
        ) : null}

        <Text style={styles.footer} fixed>
          Inari · generiert am {new Date().toLocaleDateString("de-DE")}
        </Text>
      </Page>
    </Document>
  );
}

function MailMergePdfDocument({ request }: { request: PatientMailMergeExportRequest }) {
  return (
    <Document title={request.title} author="Inari">
      {request.documents.map((document) => (
        <Page key={document.patientId} size="A4" style={styles.page}>
          <PdfHeader
            title={request.title}
            subtitle={`Patient: ${document.patientName}`}
          />
          <View style={styles.section}>
            <Text style={styles.h2}>{document.subject}</Text>
            <Text style={styles.body}>{document.body}</Text>
          </View>
          <Text style={styles.footer} fixed>
            Inari · Patientendokument
          </Text>
        </Page>
      ))}
    </Document>
  );
}

export async function renderReportPdfBuffer(request: ReportExportRequest) {
  if (request.dayPages && request.dayPages.length > 0) {
    return renderToBuffer(<MultiDayReportPdfDocument request={request} />);
  }
  return renderToBuffer(<ReportPdfDocument request={request} />);
}

export async function renderMailMergePdfBuffer(request: PatientMailMergeExportRequest) {
  return renderToBuffer(<MailMergePdfDocument request={request} />);
}
