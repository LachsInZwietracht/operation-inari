import { MEAL_SLOT_LABELS } from "@/lib/constants";
import { matchSmartInput } from "@/lib/nlp-matching";
import type {
  DigitalProtocolSubmission,
  Food,
  MealSlotType,
  ProtocolDraftPrefill,
  SubmissionEntry,
} from "@/lib/types";

const MATCH_CONFIDENCE_THRESHOLD = 0.8;
const FALLBACK_MEAL_SLOT: MealSlotType = "mittagessen";
const VALID_MEAL_SLOTS = new Set<MealSlotType>([
  "fruehstueck",
  "snack_vormittag",
  "mittagessen",
  "snack_nachmittag",
  "abendessen",
]);

function normalizeMealSlot(value: string): MealSlotType {
  if (VALID_MEAL_SLOTS.has(value as MealSlotType)) {
    return value as MealSlotType;
  }

  return FALLBACK_MEAL_SLOT;
}

function buildSourceLine(entry: SubmissionEntry, matchedFoodName?: string) {
  const mealSlot = normalizeMealSlot(entry.mealSlot);
  const timeLabel = entry.time ? ` (${entry.time})` : "";
  const matchLabel = matchedFoodName ? ` -> Match: ${matchedFoodName}` : " -> manuell pruefen";
  return `- ${MEAL_SLOT_LABELS[mealSlot]}${timeLabel}: ${entry.freeText}${matchLabel}`;
}

function isConfidentSubmissionMatch(entry: SubmissionEntry, confidence: number) {
  if (confidence >= MATCH_CONFIDENCE_THRESHOLD) {
    return true;
  }

  const hasStructuredPortion = /^\s*(\d+([.,]\d+)?|ein|eine)\b/i.test(entry.freeText);
  const isCompactDescription = entry.freeText.trim().split(/\s+/).length <= 4;

  return confidence >= 0.5 && hasStructuredPortion && isCompactDescription;
}

export function buildProtocolDraftFromSubmission(
  submission: DigitalProtocolSubmission,
  foods: Food[],
): ProtocolDraftPrefill {
  const sourceSections: string[] = [];
  const days = submission.days.map((day) => {
    const sourceLines: string[] = [];
    const entries = day.entries.flatMap((entry) => {
      const match = matchSmartInput(entry.freeText, foods);
      const hasConfidentMatch = !!match && isConfidentSubmissionMatch(entry, match.confidence);

      sourceLines.push(buildSourceLine(entry, hasConfidentMatch ? match.foodName : undefined));

      if (!hasConfidentMatch || !match) {
        return [];
      }

      return [
        {
          foodId: match.foodId,
          amount: match.amount,
          mealSlot: normalizeMealSlot(entry.mealSlot),
          time: entry.time ?? "",
          measurementMode: match.unit ? ("household" as const) : ("grams" as const),
          householdUnit: match.unit,
          householdQuantity: match.quantity,
        },
      ];
    });

    sourceSections.push(`${day.date}\n${sourceLines.join("\n")}`);

    return {
      date: day.date,
      entries,
    };
  });

  const notesSections = [
    `Quelle: Digitales Protokoll eingereicht am ${submission.submittedAt.slice(0, 10)}.`,
  ];

  if (submission.notes?.trim()) {
    notesSections.push(`Anmerkungen des Patienten:\n${submission.notes.trim()}`);
  }

  notesSections.push(`Originaleintraege:\n${sourceSections.join("\n\n")}`);

  return {
    title: `Digitales Protokoll vom ${submission.submittedAt.slice(0, 10)}`,
    type: "ernaehrungsprotokoll",
    notes: notesSections.join("\n\n"),
    days,
    metadata: {
      assessmentMethod: "diet_diary",
      documentedDays: submission.days.length,
      source: "digital_protocol_submission",
      sourceSubmissionId: submission.id,
    },
  };
}
