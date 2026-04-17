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
});

function PdfHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <View style={styles.header}>
      <Text style={styles.brand}>Operation Prodi</Text>
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

function ReportPdfDocument({ request }: { request: ReportExportRequest }) {
  return (
    <Document title={request.title} author="Operation Prodi">
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

        {request.specialNotes && request.specialNotes.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.h2}>Zusatzhinweise</Text>
            {request.specialNotes.map((note) => (
              <Text key={note} style={styles.listItem}>{note}</Text>
            ))}
          </View>
        ) : null}

        <Text style={styles.footer} fixed>
          Operation Prodi · generiert am {new Date().toLocaleDateString("de-DE")}
        </Text>
      </Page>
    </Document>
  );
}

function MailMergePdfDocument({ request }: { request: PatientMailMergeExportRequest }) {
  return (
    <Document title={request.title} author="Operation Prodi">
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
            Operation Prodi · Patientendokument
          </Text>
        </Page>
      ))}
    </Document>
  );
}

export async function renderReportPdfBuffer(request: ReportExportRequest) {
  return renderToBuffer(<ReportPdfDocument request={request} />);
}

export async function renderMailMergePdfBuffer(request: PatientMailMergeExportRequest) {
  return renderToBuffer(<MailMergePdfDocument request={request} />);
}
