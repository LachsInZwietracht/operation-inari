import { z } from "zod";

const shortText = z.string().max(200);
// Non-UUID legacy IDs exist, so IDs are bounded strings rather than z.uuid().
const idString = z.string().max(64);

const metricSchema = z.object({
  label: shortText,
  value: shortText,
  reference: shortText.optional(),
  coverage: shortText.optional(),
});

const metricRows = z.array(metricSchema).max(200);

const patientProfileSchema = z.object({
  periodLabel: shortText,
  calorieGoalLabel: shortText.optional(),
  macroLabel: shortText.optional(),
  preferences: z.array(shortText).max(20).optional(),
  allergies: z.array(shortText).max(50).optional(),
  goals: z.string().max(1_000).optional(),
});

const dayPageSchema = z.object({
  dateLabel: shortText,
  meals: z
    .array(
      z.object({
        slot: shortText,
        items: z.array(z.string().max(500)).max(50),
        kcal: shortText.optional(),
      }),
    )
    .max(10),
  macroSummary: shortText.optional(),
  energyBar: z
    .object({
      value: z.number().finite().nonnegative(),
      target: z.number().finite().nonnegative(),
      label: shortText,
    })
    .optional(),
  nutrientRows: metricRows.optional(),
  vitaminRows: metricRows.optional(),
  mineralRows: metricRows.optional(),
});

const recipeCardSchema = z.object({
  name: shortText,
  plannedForLabel: shortText,
  portionLabel: shortText,
  kcalPerPortion: shortText.optional(),
  timeLabel: shortText.optional(),
  ingredients: z.array(z.string().max(500)).max(80),
  instructions: z.array(z.string().max(2_000)).max(50),
});

/**
 * Runtime validation for ReportExportRequest. Keep in sync with the interface
 * in lib/types/platform.ts — the route assigns the parsed result to a
 * ReportExportRequest, so schema drift fails typecheck.
 */
export const reportExportRequestSchema = z.object({
  format: z.enum(["CSV", "PDF"]),
  title: z.string().min(1).max(200),
  // Rendered into the Content-Disposition header (quoted with ") — restrict to
  // filename-safe characters, no quotes/backslashes/path separators/controls.
  fileBaseName: z
    .string()
    .min(1)
    .max(120)
    .regex(/^[A-Za-z0-9äöüÄÖÜß()_. -]+$/),
  disposition: z.enum(["attachment", "inline"]).optional(),
  reportId: idString.optional(),
  reportVersionId: idString.optional(),
  patientId: idString.optional(),
  patientName: shortText.optional(),
  patientIndication: z.string().max(500).optional(),
  planId: idString.optional(),
  protocolId: idString.optional(),
  planDateLabel: shortText,
  reportLength: z.enum(["short", "full"]),
  selectedSections: z.object({
    summary: z.boolean(),
    table: z.boolean(),
    charts: z.boolean(),
    meals: z.boolean(),
    notes: z.boolean(),
  }),
  activeSectionLabels: z.array(shortText).max(20),
  summaryMetrics: metricRows,
  nutrientRows: metricRows,
  vitaminRows: metricRows,
  mineralRows: metricRows,
  mealRows: z.array(z.object({ slot: shortText, summary: z.string().max(2000) })).max(50),
  notes: z.string().max(5_000),
  narrative: z.string().max(10_000).optional(),
  badges: z.array(shortText).max(20).optional(),
  specialNotes: z.array(z.string().max(1_000)).max(50).optional(),
  lmivRows: metricRows.optional(),
  allergenDeclaration: z.array(shortText).max(50).optional(),
  additiveDeclaration: z.array(shortText).max(50).optional(),
  retentionPolicyLabel: shortText.optional(),
  documentPackLabel: shortText.optional(),
  patientProfile: patientProfileSchema.optional(),
  dayPages: z.array(dayPageSchema).max(31).optional(),
  recipeAppendix: z.array(recipeCardSchema).max(40).optional(),
});
