import type {
  AgeGroup,
  ReferenceBracket,
  ReferenceStandard,
} from "@/lib/types";

// ── Age groups (DACH standard brackets) ────────────────────────

export const AGE_GROUPS: AgeGroup[] = [
  { id: "0-4m", label: "0–4 Monate", minAge: 0, maxAge: 0.33 },
  { id: "4-12m", label: "4–12 Monate", minAge: 0.33, maxAge: 1 },
  { id: "1-4", label: "1–4 Jahre", minAge: 1, maxAge: 4 },
  { id: "4-7", label: "4–7 Jahre", minAge: 4, maxAge: 7 },
  { id: "7-10", label: "7–10 Jahre", minAge: 7, maxAge: 10 },
  { id: "10-13", label: "10–13 Jahre", minAge: 10, maxAge: 13 },
  { id: "13-15", label: "13–15 Jahre", minAge: 13, maxAge: 15 },
  { id: "15-19", label: "15–19 Jahre", minAge: 15, maxAge: 19 },
  { id: "19-25", label: "19–25 Jahre", minAge: 19, maxAge: 25 },
  { id: "25-51", label: "25–51 Jahre", minAge: 25, maxAge: 51 },
  { id: "51-65", label: "51–65 Jahre", minAge: 51, maxAge: 65 },
  { id: "65+", label: "65+ Jahre", minAge: 65, maxAge: Infinity },
];

// ── Helper: create a bracket ───────────────────────────────────

function b(
  ageGroupId: string,
  gender: "m" | "w",
  values: [string, number][],
): ReferenceBracket {
  return {
    ageGroupId,
    gender,
    lifeStage: "none",
    values: values.map(([nutrientId, amount]) => ({ nutrientId, amount })),
  };
}

function lifeStageB(
  lifeStage: "pregnant_t1" | "pregnant_t2" | "pregnant_t3" | "lactating",
  values: [string, number][],
): ReferenceBracket {
  return {
    ageGroupId: "19-25", // base age group for life-stage brackets
    gender: "w",
    lifeStage,
    values: values.map(([nutrientId, amount]) => ({ nutrientId, amount })),
  };
}

// ── Nutrient key order for readability ─────────────────────────
// energie, eiweiss, fett, kohlenhydrate, ballaststoffe, zucker,
// gesaettigte_fettsaeuren, ungesaettigte_fettsaeuren, wasser,
// vitamin_a, vitamin_b1, vitamin_b2, vitamin_b6, vitamin_b12,
// vitamin_c, vitamin_d, vitamin_e, folsaeure, niacin,
// calcium, eisen, magnesium, kalium, natrium, zink, phosphor, jod

type NV = [string, number][];

/** Standard adult male nutrients for DGE (25-51) */
const DGE_M_25_51: NV = [
  ["energie", 2400], ["eiweiss", 57], ["fett", 80], ["kohlenhydrate", 300],
  ["ballaststoffe", 30], ["zucker", 60], ["gesaettigte_fettsaeuren", 27],
  ["ungesaettigte_fettsaeuren", 53], ["wasser", 2500],
  ["vitamin_a", 850], ["vitamin_b1", 1.3], ["vitamin_b2", 1.4],
  ["vitamin_b6", 1.6], ["vitamin_b12", 4.0], ["vitamin_c", 110],
  ["vitamin_d", 20], ["vitamin_e", 15], ["folsaeure", 300],
  ["niacin", 16],
  ["calcium", 1000], ["eisen", 10], ["magnesium", 400],
  ["kalium", 4000], ["natrium", 1500], ["zink", 14],
  ["phosphor", 700], ["jod", 200],
];

/** Standard adult female nutrients for DGE (25-51) */
const DGE_W_25_51: NV = [
  ["energie", 1900], ["eiweiss", 48], ["fett", 63], ["kohlenhydrate", 237],
  ["ballaststoffe", 30], ["zucker", 47], ["gesaettigte_fettsaeuren", 21],
  ["ungesaettigte_fettsaeuren", 42], ["wasser", 2000],
  ["vitamin_a", 700], ["vitamin_b1", 1.0], ["vitamin_b2", 1.1],
  ["vitamin_b6", 1.4], ["vitamin_b12", 4.0], ["vitamin_c", 95],
  ["vitamin_d", 20], ["vitamin_e", 12], ["folsaeure", 300],
  ["niacin", 13],
  ["calcium", 1000], ["eisen", 15], ["magnesium", 300],
  ["kalium", 4000], ["natrium", 1500], ["zink", 8],
  ["phosphor", 700], ["jod", 200],
];

// ═══════════════════════════════════════════════════════════════
// DGE Reference Standard (full age/gender matrix)
// Source: DGE-Referenzwerte für die Nährstoffzufuhr, 2024
// ═══════════════════════════════════════════════════════════════

const DGE_BRACKETS: ReferenceBracket[] = [
  // ── Children 1-4 ─────────────────────────
  b("1-4", "m", [
    ["energie", 1200], ["eiweiss", 14], ["fett", 40], ["kohlenhydrate", 150],
    ["ballaststoffe", 10], ["zucker", 30], ["gesaettigte_fettsaeuren", 13],
    ["ungesaettigte_fettsaeuren", 27], ["wasser", 820],
    ["vitamin_a", 300], ["vitamin_b1", 0.6], ["vitamin_b2", 0.7],
    ["vitamin_b6", 0.4], ["vitamin_b12", 1.0], ["vitamin_c", 20],
    ["vitamin_d", 20], ["vitamin_e", 6], ["folsaeure", 120],
    ["niacin", 8],
    ["calcium", 600], ["eisen", 8], ["magnesium", 80],
    ["kalium", 1100], ["natrium", 400], ["zink", 3],
    ["phosphor", 500], ["jod", 100],
  ]),
  b("1-4", "w", [
    ["energie", 1100], ["eiweiss", 14], ["fett", 37], ["kohlenhydrate", 138],
    ["ballaststoffe", 10], ["zucker", 28], ["gesaettigte_fettsaeuren", 12],
    ["ungesaettigte_fettsaeuren", 25], ["wasser", 820],
    ["vitamin_a", 300], ["vitamin_b1", 0.6], ["vitamin_b2", 0.7],
    ["vitamin_b6", 0.4], ["vitamin_b12", 1.0], ["vitamin_c", 20],
    ["vitamin_d", 20], ["vitamin_e", 5], ["folsaeure", 120],
    ["niacin", 8],
    ["calcium", 600], ["eisen", 8], ["magnesium", 80],
    ["kalium", 1100], ["natrium", 400], ["zink", 3],
    ["phosphor", 500], ["jod", 100],
  ]),

  // ── Children 4-7 ─────────────────────────
  b("4-7", "m", [
    ["energie", 1400], ["eiweiss", 18], ["fett", 47], ["kohlenhydrate", 175],
    ["ballaststoffe", 15], ["zucker", 35], ["gesaettigte_fettsaeuren", 16],
    ["ungesaettigte_fettsaeuren", 31], ["wasser", 940],
    ["vitamin_a", 350], ["vitamin_b1", 0.7], ["vitamin_b2", 0.8],
    ["vitamin_b6", 0.5], ["vitamin_b12", 1.5], ["vitamin_c", 30],
    ["vitamin_d", 20], ["vitamin_e", 8], ["folsaeure", 140],
    ["niacin", 9],
    ["calcium", 750], ["eisen", 8], ["magnesium", 120],
    ["kalium", 1300], ["natrium", 500], ["zink", 5],
    ["phosphor", 600], ["jod", 120],
  ]),
  b("4-7", "w", [
    ["energie", 1300], ["eiweiss", 18], ["fett", 43], ["kohlenhydrate", 163],
    ["ballaststoffe", 15], ["zucker", 33], ["gesaettigte_fettsaeuren", 14],
    ["ungesaettigte_fettsaeuren", 29], ["wasser", 940],
    ["vitamin_a", 350], ["vitamin_b1", 0.7], ["vitamin_b2", 0.8],
    ["vitamin_b6", 0.5], ["vitamin_b12", 1.5], ["vitamin_c", 30],
    ["vitamin_d", 20], ["vitamin_e", 8], ["folsaeure", 140],
    ["niacin", 9],
    ["calcium", 750], ["eisen", 8], ["magnesium", 120],
    ["kalium", 1300], ["natrium", 500], ["zink", 5],
    ["phosphor", 600], ["jod", 120],
  ]),

  // ── Children 7-10 ────────────────────────
  b("7-10", "m", [
    ["energie", 1700], ["eiweiss", 24], ["fett", 57], ["kohlenhydrate", 213],
    ["ballaststoffe", 20], ["zucker", 43], ["gesaettigte_fettsaeuren", 19],
    ["ungesaettigte_fettsaeuren", 38], ["wasser", 970],
    ["vitamin_a", 450], ["vitamin_b1", 0.9], ["vitamin_b2", 1.0],
    ["vitamin_b6", 0.7], ["vitamin_b12", 2.0], ["vitamin_c", 45],
    ["vitamin_d", 20], ["vitamin_e", 10], ["folsaeure", 180],
    ["niacin", 11],
    ["calcium", 900], ["eisen", 10], ["magnesium", 170],
    ["kalium", 2000], ["natrium", 750], ["zink", 7],
    ["phosphor", 600], ["jod", 140],
  ]),
  b("7-10", "w", [
    ["energie", 1500], ["eiweiss", 24], ["fett", 50], ["kohlenhydrate", 188],
    ["ballaststoffe", 20], ["zucker", 38], ["gesaettigte_fettsaeuren", 17],
    ["ungesaettigte_fettsaeuren", 33], ["wasser", 970],
    ["vitamin_a", 450], ["vitamin_b1", 0.9], ["vitamin_b2", 1.0],
    ["vitamin_b6", 0.7], ["vitamin_b12", 2.0], ["vitamin_c", 45],
    ["vitamin_d", 20], ["vitamin_e", 9], ["folsaeure", 180],
    ["niacin", 11],
    ["calcium", 900], ["eisen", 10], ["magnesium", 170],
    ["kalium", 2000], ["natrium", 750], ["zink", 7],
    ["phosphor", 600], ["jod", 140],
  ]),

  // ── Adolescents 10-13 ────────────────────
  b("10-13", "m", [
    ["energie", 2000], ["eiweiss", 34], ["fett", 67], ["kohlenhydrate", 250],
    ["ballaststoffe", 25], ["zucker", 50], ["gesaettigte_fettsaeuren", 22],
    ["ungesaettigte_fettsaeuren", 45], ["wasser", 1170],
    ["vitamin_a", 600], ["vitamin_b1", 1.0], ["vitamin_b2", 1.1],
    ["vitamin_b6", 1.0], ["vitamin_b12", 3.0], ["vitamin_c", 65],
    ["vitamin_d", 20], ["vitamin_e", 13], ["folsaeure", 240],
    ["niacin", 13],
    ["calcium", 1100], ["eisen", 12], ["magnesium", 230],
    ["kalium", 2900], ["natrium", 1100], ["zink", 9],
    ["phosphor", 700], ["jod", 180],
  ]),
  b("10-13", "w", [
    ["energie", 1800], ["eiweiss", 35], ["fett", 60], ["kohlenhydrate", 225],
    ["ballaststoffe", 25], ["zucker", 45], ["gesaettigte_fettsaeuren", 20],
    ["ungesaettigte_fettsaeuren", 40], ["wasser", 1170],
    ["vitamin_a", 600], ["vitamin_b1", 1.0], ["vitamin_b2", 1.0],
    ["vitamin_b6", 1.0], ["vitamin_b12", 3.0], ["vitamin_c", 65],
    ["vitamin_d", 20], ["vitamin_e", 11], ["folsaeure", 240],
    ["niacin", 11],
    ["calcium", 1100], ["eisen", 15], ["magnesium", 250],
    ["kalium", 2900], ["natrium", 1100], ["zink", 7],
    ["phosphor", 700], ["jod", 180],
  ]),

  // ── Adolescents 13-15 ────────────────────
  b("13-15", "m", [
    ["energie", 2300], ["eiweiss", 46], ["fett", 77], ["kohlenhydrate", 288],
    ["ballaststoffe", 30], ["zucker", 58], ["gesaettigte_fettsaeuren", 26],
    ["ungesaettigte_fettsaeuren", 51], ["wasser", 1330],
    ["vitamin_a", 800], ["vitamin_b1", 1.2], ["vitamin_b2", 1.4],
    ["vitamin_b6", 1.4], ["vitamin_b12", 4.0], ["vitamin_c", 85],
    ["vitamin_d", 20], ["vitamin_e", 14], ["folsaeure", 300],
    ["niacin", 15],
    ["calcium", 1200], ["eisen", 12], ["magnesium", 310],
    ["kalium", 3600], ["natrium", 1400], ["zink", 12],
    ["phosphor", 700], ["jod", 200],
  ]),
  b("13-15", "w", [
    ["energie", 2000], ["eiweiss", 45], ["fett", 67], ["kohlenhydrate", 250],
    ["ballaststoffe", 30], ["zucker", 50], ["gesaettigte_fettsaeuren", 22],
    ["ungesaettigte_fettsaeuren", 45], ["wasser", 1310],
    ["vitamin_a", 700], ["vitamin_b1", 1.0], ["vitamin_b2", 1.1],
    ["vitamin_b6", 1.4], ["vitamin_b12", 4.0], ["vitamin_c", 85],
    ["vitamin_d", 20], ["vitamin_e", 12], ["folsaeure", 300],
    ["niacin", 13],
    ["calcium", 1200], ["eisen", 15], ["magnesium", 310],
    ["kalium", 3600], ["natrium", 1400], ["zink", 8],
    ["phosphor", 700], ["jod", 200],
  ]),

  // ── Adolescents/Young adults 15-19 ───────
  b("15-19", "m", [
    ["energie", 2600], ["eiweiss", 56], ["fett", 87], ["kohlenhydrate", 325],
    ["ballaststoffe", 30], ["zucker", 65], ["gesaettigte_fettsaeuren", 29],
    ["ungesaettigte_fettsaeuren", 58], ["wasser", 1530],
    ["vitamin_a", 950], ["vitamin_b1", 1.4], ["vitamin_b2", 1.6],
    ["vitamin_b6", 1.6], ["vitamin_b12", 4.0], ["vitamin_c", 105],
    ["vitamin_d", 20], ["vitamin_e", 15], ["folsaeure", 300],
    ["niacin", 17],
    ["calcium", 1200], ["eisen", 12], ["magnesium", 400],
    ["kalium", 4000], ["natrium", 1500], ["zink", 14],
    ["phosphor", 700], ["jod", 200],
  ]),
  b("15-19", "w", [
    ["energie", 2000], ["eiweiss", 46], ["fett", 67], ["kohlenhydrate", 250],
    ["ballaststoffe", 30], ["zucker", 50], ["gesaettigte_fettsaeuren", 22],
    ["ungesaettigte_fettsaeuren", 45], ["wasser", 1310],
    ["vitamin_a", 800], ["vitamin_b1", 1.1], ["vitamin_b2", 1.2],
    ["vitamin_b6", 1.2], ["vitamin_b12", 4.0], ["vitamin_c", 90],
    ["vitamin_d", 20], ["vitamin_e", 12], ["folsaeure", 300],
    ["niacin", 13],
    ["calcium", 1200], ["eisen", 15], ["magnesium", 350],
    ["kalium", 4000], ["natrium", 1500], ["zink", 8],
    ["phosphor", 700], ["jod", 200],
  ]),

  // ── Adults 19-25 ─────────────────────────
  b("19-25", "m", [
    ["energie", 2400], ["eiweiss", 57], ["fett", 80], ["kohlenhydrate", 300],
    ["ballaststoffe", 30], ["zucker", 60], ["gesaettigte_fettsaeuren", 27],
    ["ungesaettigte_fettsaeuren", 53], ["wasser", 2500],
    ["vitamin_a", 850], ["vitamin_b1", 1.3], ["vitamin_b2", 1.4],
    ["vitamin_b6", 1.6], ["vitamin_b12", 4.0], ["vitamin_c", 110],
    ["vitamin_d", 20], ["vitamin_e", 15], ["folsaeure", 300],
    ["niacin", 16],
    ["calcium", 1000], ["eisen", 10], ["magnesium", 400],
    ["kalium", 4000], ["natrium", 1500], ["zink", 14],
    ["phosphor", 700], ["jod", 200],
  ]),
  b("19-25", "w", [
    ["energie", 1900], ["eiweiss", 48], ["fett", 63], ["kohlenhydrate", 237],
    ["ballaststoffe", 30], ["zucker", 47], ["gesaettigte_fettsaeuren", 21],
    ["ungesaettigte_fettsaeuren", 42], ["wasser", 2000],
    ["vitamin_a", 700], ["vitamin_b1", 1.0], ["vitamin_b2", 1.1],
    ["vitamin_b6", 1.4], ["vitamin_b12", 4.0], ["vitamin_c", 95],
    ["vitamin_d", 20], ["vitamin_e", 12], ["folsaeure", 300],
    ["niacin", 13],
    ["calcium", 1000], ["eisen", 15], ["magnesium", 310],
    ["kalium", 4000], ["natrium", 1500], ["zink", 8],
    ["phosphor", 700], ["jod", 200],
  ]),

  // ── Adults 25-51 ─────────────────────────
  b("25-51", "m", DGE_M_25_51),
  b("25-51", "w", DGE_W_25_51),

  // ── Adults 51-65 ─────────────────────────
  b("51-65", "m", [
    ["energie", 2200], ["eiweiss", 57], ["fett", 73], ["kohlenhydrate", 275],
    ["ballaststoffe", 30], ["zucker", 55], ["gesaettigte_fettsaeuren", 24],
    ["ungesaettigte_fettsaeuren", 49], ["wasser", 2300],
    ["vitamin_a", 850], ["vitamin_b1", 1.2], ["vitamin_b2", 1.3],
    ["vitamin_b6", 1.6], ["vitamin_b12", 4.0], ["vitamin_c", 110],
    ["vitamin_d", 20], ["vitamin_e", 14], ["folsaeure", 300],
    ["niacin", 15],
    ["calcium", 1000], ["eisen", 10], ["magnesium", 350],
    ["kalium", 4000], ["natrium", 1500], ["zink", 14],
    ["phosphor", 700], ["jod", 200],
  ]),
  b("51-65", "w", [
    ["energie", 1800], ["eiweiss", 48], ["fett", 60], ["kohlenhydrate", 225],
    ["ballaststoffe", 30], ["zucker", 45], ["gesaettigte_fettsaeuren", 20],
    ["ungesaettigte_fettsaeuren", 40], ["wasser", 1900],
    ["vitamin_a", 700], ["vitamin_b1", 1.0], ["vitamin_b2", 1.0],
    ["vitamin_b6", 1.4], ["vitamin_b12", 4.0], ["vitamin_c", 95],
    ["vitamin_d", 20], ["vitamin_e", 12], ["folsaeure", 300],
    ["niacin", 12],
    ["calcium", 1000], ["eisen", 10], ["magnesium", 300],
    ["kalium", 4000], ["natrium", 1500], ["zink", 8],
    ["phosphor", 700], ["jod", 200],
  ]),

  // ── Seniors 65+ ──────────────────────────
  b("65+", "m", [
    ["energie", 2000], ["eiweiss", 57], ["fett", 67], ["kohlenhydrate", 250],
    ["ballaststoffe", 30], ["zucker", 50], ["gesaettigte_fettsaeuren", 22],
    ["ungesaettigte_fettsaeuren", 45], ["wasser", 2100],
    ["vitamin_a", 850], ["vitamin_b1", 1.1], ["vitamin_b2", 1.3],
    ["vitamin_b6", 1.6], ["vitamin_b12", 4.0], ["vitamin_c", 110],
    ["vitamin_d", 20], ["vitamin_e", 13], ["folsaeure", 300],
    ["niacin", 14],
    ["calcium", 1000], ["eisen", 10], ["magnesium", 350],
    ["kalium", 4000], ["natrium", 1500], ["zink", 14],
    ["phosphor", 700], ["jod", 200],
  ]),
  b("65+", "w", [
    ["energie", 1600], ["eiweiss", 48], ["fett", 53], ["kohlenhydrate", 200],
    ["ballaststoffe", 30], ["zucker", 40], ["gesaettigte_fettsaeuren", 18],
    ["ungesaettigte_fettsaeuren", 35], ["wasser", 1800],
    ["vitamin_a", 700], ["vitamin_b1", 1.0], ["vitamin_b2", 1.0],
    ["vitamin_b6", 1.4], ["vitamin_b12", 4.0], ["vitamin_c", 95],
    ["vitamin_d", 20], ["vitamin_e", 11], ["folsaeure", 300],
    ["niacin", 11],
    ["calcium", 1000], ["eisen", 10], ["magnesium", 300],
    ["kalium", 4000], ["natrium", 1500], ["zink", 8],
    ["phosphor", 700], ["jod", 200],
  ]),

  // ── Life stages (pregnancy & lactation) ──
  lifeStageB("pregnant_t1", [
    ["energie", 1900], ["eiweiss", 55], ["fett", 63], ["kohlenhydrate", 237],
    ["ballaststoffe", 30], ["zucker", 47], ["gesaettigte_fettsaeuren", 21],
    ["ungesaettigte_fettsaeuren", 42], ["wasser", 2300],
    ["vitamin_a", 800], ["vitamin_b1", 1.2], ["vitamin_b2", 1.3],
    ["vitamin_b6", 1.9], ["vitamin_b12", 4.5], ["vitamin_c", 105],
    ["vitamin_d", 20], ["vitamin_e", 13], ["folsaeure", 550],
    ["niacin", 14],
    ["calcium", 1000], ["eisen", 30], ["magnesium", 310],
    ["kalium", 4000], ["natrium", 1500], ["zink", 10],
    ["phosphor", 800], ["jod", 230],
  ]),
  lifeStageB("pregnant_t2", [
    ["energie", 2150], ["eiweiss", 55], ["fett", 72], ["kohlenhydrate", 269],
    ["ballaststoffe", 30], ["zucker", 54], ["gesaettigte_fettsaeuren", 24],
    ["ungesaettigte_fettsaeuren", 48], ["wasser", 2400],
    ["vitamin_a", 800], ["vitamin_b1", 1.2], ["vitamin_b2", 1.3],
    ["vitamin_b6", 1.9], ["vitamin_b12", 4.5], ["vitamin_c", 105],
    ["vitamin_d", 20], ["vitamin_e", 13], ["folsaeure", 550],
    ["niacin", 14],
    ["calcium", 1000], ["eisen", 30], ["magnesium", 310],
    ["kalium", 4000], ["natrium", 1500], ["zink", 10],
    ["phosphor", 800], ["jod", 230],
  ]),
  lifeStageB("pregnant_t3", [
    ["energie", 2400], ["eiweiss", 55], ["fett", 80], ["kohlenhydrate", 300],
    ["ballaststoffe", 30], ["zucker", 60], ["gesaettigte_fettsaeuren", 27],
    ["ungesaettigte_fettsaeuren", 53], ["wasser", 2500],
    ["vitamin_a", 800], ["vitamin_b1", 1.2], ["vitamin_b2", 1.3],
    ["vitamin_b6", 1.9], ["vitamin_b12", 4.5], ["vitamin_c", 105],
    ["vitamin_d", 20], ["vitamin_e", 13], ["folsaeure", 550],
    ["niacin", 14],
    ["calcium", 1000], ["eisen", 30], ["magnesium", 310],
    ["kalium", 4000], ["natrium", 1500], ["zink", 11],
    ["phosphor", 800], ["jod", 230],
  ]),
  lifeStageB("lactating", [
    ["energie", 2400], ["eiweiss", 63], ["fett", 80], ["kohlenhydrate", 300],
    ["ballaststoffe", 30], ["zucker", 60], ["gesaettigte_fettsaeuren", 27],
    ["ungesaettigte_fettsaeuren", 53], ["wasser", 2700],
    ["vitamin_a", 1300], ["vitamin_b1", 1.3], ["vitamin_b2", 1.4],
    ["vitamin_b6", 1.9], ["vitamin_b12", 5.5], ["vitamin_c", 125],
    ["vitamin_d", 20], ["vitamin_e", 17], ["folsaeure", 450],
    ["niacin", 16],
    ["calcium", 1000], ["eisen", 20], ["magnesium", 390],
    ["kalium", 4400], ["natrium", 1500], ["zink", 13],
    ["phosphor", 900], ["jod", 260],
  ]),
];

// ═══════════════════════════════════════════════════════════════
// ÖGE Reference Standard
// Austrian values — mostly identical to DACH but with some
// national variations in energy and mineral recommendations
// ═══════════════════════════════════════════════════════════════

function applyDelta(base: NV, deltas: Partial<Record<string, number>>): NV {
  return base.map(([id, val]) => [id, deltas[id] ?? val]);
}

const OEGE_BRACKETS: ReferenceBracket[] = [
  // Key differences from DGE: slightly higher calcium for 65+, iodine +10µg
  b("1-4", "m", applyDelta(DGE_BRACKETS[0].values.map(v => [v.nutrientId, v.amount]), {})),
  b("1-4", "w", applyDelta(DGE_BRACKETS[1].values.map(v => [v.nutrientId, v.amount]), {})),
  b("4-7", "m", applyDelta(DGE_BRACKETS[2].values.map(v => [v.nutrientId, v.amount]), {})),
  b("4-7", "w", applyDelta(DGE_BRACKETS[3].values.map(v => [v.nutrientId, v.amount]), {})),
  b("7-10", "m", applyDelta(DGE_BRACKETS[4].values.map(v => [v.nutrientId, v.amount]), {})),
  b("7-10", "w", applyDelta(DGE_BRACKETS[5].values.map(v => [v.nutrientId, v.amount]), {})),
  b("10-13", "m", applyDelta(DGE_BRACKETS[6].values.map(v => [v.nutrientId, v.amount]), {})),
  b("10-13", "w", applyDelta(DGE_BRACKETS[7].values.map(v => [v.nutrientId, v.amount]), {})),
  b("13-15", "m", applyDelta(DGE_BRACKETS[8].values.map(v => [v.nutrientId, v.amount]), {})),
  b("13-15", "w", applyDelta(DGE_BRACKETS[9].values.map(v => [v.nutrientId, v.amount]), {})),
  b("15-19", "m", applyDelta(DGE_BRACKETS[10].values.map(v => [v.nutrientId, v.amount]), {})),
  b("15-19", "w", applyDelta(DGE_BRACKETS[11].values.map(v => [v.nutrientId, v.amount]), {})),
  b("19-25", "m", applyDelta(DGE_M_25_51, {})),
  b("19-25", "w", applyDelta(DGE_W_25_51, {})),
  b("25-51", "m", applyDelta(DGE_M_25_51, { jod: 210 })),
  b("25-51", "w", applyDelta(DGE_W_25_51, { jod: 210 })),
  b("51-65", "m", applyDelta(DGE_BRACKETS[16].values.map(v => [v.nutrientId, v.amount]), { jod: 210 })),
  b("51-65", "w", applyDelta(DGE_BRACKETS[17].values.map(v => [v.nutrientId, v.amount]), { jod: 210 })),
  b("65+", "m", applyDelta(DGE_BRACKETS[18].values.map(v => [v.nutrientId, v.amount]), {
    calcium: 1200, vitamin_d: 20, jod: 210,
  })),
  b("65+", "w", applyDelta(DGE_BRACKETS[19].values.map(v => [v.nutrientId, v.amount]), {
    calcium: 1200, vitamin_d: 20, jod: 210,
  })),
];

// ═══════════════════════════════════════════════════════════════
// SGE Reference Standard
// Swiss values — aligned with DACH, notable differences in salt
// recommendation (max 5g/day = 2000mg Na) and vitamin D
// ═══════════════════════════════════════════════════════════════

const SGE_BRACKETS: ReferenceBracket[] = [
  b("1-4", "m", applyDelta(DGE_BRACKETS[0].values.map(v => [v.nutrientId, v.amount]), { natrium: 500 })),
  b("1-4", "w", applyDelta(DGE_BRACKETS[1].values.map(v => [v.nutrientId, v.amount]), { natrium: 500 })),
  b("4-7", "m", applyDelta(DGE_BRACKETS[2].values.map(v => [v.nutrientId, v.amount]), { natrium: 600 })),
  b("4-7", "w", applyDelta(DGE_BRACKETS[3].values.map(v => [v.nutrientId, v.amount]), { natrium: 600 })),
  b("7-10", "m", applyDelta(DGE_BRACKETS[4].values.map(v => [v.nutrientId, v.amount]), { natrium: 900 })),
  b("7-10", "w", applyDelta(DGE_BRACKETS[5].values.map(v => [v.nutrientId, v.amount]), { natrium: 900 })),
  b("10-13", "m", applyDelta(DGE_BRACKETS[6].values.map(v => [v.nutrientId, v.amount]), { natrium: 1300 })),
  b("10-13", "w", applyDelta(DGE_BRACKETS[7].values.map(v => [v.nutrientId, v.amount]), { natrium: 1300 })),
  b("13-15", "m", applyDelta(DGE_BRACKETS[8].values.map(v => [v.nutrientId, v.amount]), { natrium: 1500 })),
  b("13-15", "w", applyDelta(DGE_BRACKETS[9].values.map(v => [v.nutrientId, v.amount]), { natrium: 1500 })),
  b("15-19", "m", applyDelta(DGE_BRACKETS[10].values.map(v => [v.nutrientId, v.amount]), { natrium: 1500 })),
  b("15-19", "w", applyDelta(DGE_BRACKETS[11].values.map(v => [v.nutrientId, v.amount]), { natrium: 1500 })),
  b("19-25", "m", applyDelta(DGE_M_25_51, { natrium: 2000 })),
  b("19-25", "w", applyDelta(DGE_W_25_51, { natrium: 2000 })),
  b("25-51", "m", applyDelta(DGE_M_25_51, { natrium: 2000 })),
  b("25-51", "w", applyDelta(DGE_W_25_51, { natrium: 2000 })),
  b("51-65", "m", applyDelta(DGE_BRACKETS[16].values.map(v => [v.nutrientId, v.amount]), { natrium: 2000 })),
  b("51-65", "w", applyDelta(DGE_BRACKETS[17].values.map(v => [v.nutrientId, v.amount]), { natrium: 2000 })),
  b("65+", "m", applyDelta(DGE_BRACKETS[18].values.map(v => [v.nutrientId, v.amount]), { natrium: 2000, vitamin_d: 20 })),
  b("65+", "w", applyDelta(DGE_BRACKETS[19].values.map(v => [v.nutrientId, v.amount]), { natrium: 2000, vitamin_d: 20 })),
];

// ═══════════════════════════════════════════════════════════════
// RDA Reference Standard (US)
// Source: Dietary Reference Intakes, National Academies (2024)
// Notable differences: higher protein, different micronutrient
// targets, no separate "Ballaststoffe" approach
// ═══════════════════════════════════════════════════════════════

const RDA_BRACKETS: ReferenceBracket[] = [
  b("1-4", "m", [
    ["energie", 1300], ["eiweiss", 16], ["fett", 43], ["kohlenhydrate", 163],
    ["ballaststoffe", 14], ["zucker", 33], ["gesaettigte_fettsaeuren", 14],
    ["ungesaettigte_fettsaeuren", 29], ["wasser", 1300],
    ["vitamin_a", 300], ["vitamin_b1", 0.5], ["vitamin_b2", 0.5],
    ["vitamin_b6", 0.5], ["vitamin_b12", 0.9], ["vitamin_c", 15],
    ["vitamin_d", 15], ["vitamin_e", 6], ["folsaeure", 150],
    ["niacin", 6],
    ["calcium", 700], ["eisen", 7], ["magnesium", 80],
    ["kalium", 2000], ["natrium", 800], ["zink", 3],
    ["phosphor", 460], ["jod", 90],
  ]),
  b("1-4", "w", [
    ["energie", 1200], ["eiweiss", 16], ["fett", 40], ["kohlenhydrate", 150],
    ["ballaststoffe", 14], ["zucker", 30], ["gesaettigte_fettsaeuren", 13],
    ["ungesaettigte_fettsaeuren", 27], ["wasser", 1300],
    ["vitamin_a", 300], ["vitamin_b1", 0.5], ["vitamin_b2", 0.5],
    ["vitamin_b6", 0.5], ["vitamin_b12", 0.9], ["vitamin_c", 15],
    ["vitamin_d", 15], ["vitamin_e", 6], ["folsaeure", 150],
    ["niacin", 6],
    ["calcium", 700], ["eisen", 7], ["magnesium", 80],
    ["kalium", 2000], ["natrium", 800], ["zink", 3],
    ["phosphor", 460], ["jod", 90],
  ]),
  b("4-7", "m", [
    ["energie", 1500], ["eiweiss", 19], ["fett", 50], ["kohlenhydrate", 188],
    ["ballaststoffe", 17], ["zucker", 38], ["gesaettigte_fettsaeuren", 17],
    ["ungesaettigte_fettsaeuren", 33], ["wasser", 1700],
    ["vitamin_a", 400], ["vitamin_b1", 0.6], ["vitamin_b2", 0.6],
    ["vitamin_b6", 0.6], ["vitamin_b12", 1.2], ["vitamin_c", 25],
    ["vitamin_d", 15], ["vitamin_e", 7], ["folsaeure", 200],
    ["niacin", 8],
    ["calcium", 1000], ["eisen", 10], ["magnesium", 130],
    ["kalium", 2300], ["natrium", 1000], ["zink", 5],
    ["phosphor", 500], ["jod", 90],
  ]),
  b("4-7", "w", [
    ["energie", 1400], ["eiweiss", 19], ["fett", 47], ["kohlenhydrate", 175],
    ["ballaststoffe", 17], ["zucker", 35], ["gesaettigte_fettsaeuren", 16],
    ["ungesaettigte_fettsaeuren", 31], ["wasser", 1700],
    ["vitamin_a", 400], ["vitamin_b1", 0.6], ["vitamin_b2", 0.6],
    ["vitamin_b6", 0.6], ["vitamin_b12", 1.2], ["vitamin_c", 25],
    ["vitamin_d", 15], ["vitamin_e", 7], ["folsaeure", 200],
    ["niacin", 8],
    ["calcium", 1000], ["eisen", 10], ["magnesium", 130],
    ["kalium", 2300], ["natrium", 1000], ["zink", 5],
    ["phosphor", 500], ["jod", 90],
  ]),
  b("7-10", "m", [
    ["energie", 1800], ["eiweiss", 25], ["fett", 60], ["kohlenhydrate", 225],
    ["ballaststoffe", 22], ["zucker", 45], ["gesaettigte_fettsaeuren", 20],
    ["ungesaettigte_fettsaeuren", 40], ["wasser", 2100],
    ["vitamin_a", 600], ["vitamin_b1", 0.9], ["vitamin_b2", 0.9],
    ["vitamin_b6", 1.0], ["vitamin_b12", 1.8], ["vitamin_c", 45],
    ["vitamin_d", 15], ["vitamin_e", 11], ["folsaeure", 300],
    ["niacin", 12],
    ["calcium", 1300], ["eisen", 8], ["magnesium", 240],
    ["kalium", 2500], ["natrium", 1200], ["zink", 8],
    ["phosphor", 1250], ["jod", 120],
  ]),
  b("7-10", "w", [
    ["energie", 1600], ["eiweiss", 25], ["fett", 53], ["kohlenhydrate", 200],
    ["ballaststoffe", 22], ["zucker", 40], ["gesaettigte_fettsaeuren", 18],
    ["ungesaettigte_fettsaeuren", 35], ["wasser", 2100],
    ["vitamin_a", 600], ["vitamin_b1", 0.9], ["vitamin_b2", 0.9],
    ["vitamin_b6", 1.0], ["vitamin_b12", 1.8], ["vitamin_c", 45],
    ["vitamin_d", 15], ["vitamin_e", 11], ["folsaeure", 300],
    ["niacin", 12],
    ["calcium", 1300], ["eisen", 8], ["magnesium", 240],
    ["kalium", 2300], ["natrium", 1200], ["zink", 8],
    ["phosphor", 1250], ["jod", 120],
  ]),
  b("10-13", "m", [
    ["energie", 2100], ["eiweiss", 36], ["fett", 70], ["kohlenhydrate", 263],
    ["ballaststoffe", 26], ["zucker", 53], ["gesaettigte_fettsaeuren", 23],
    ["ungesaettigte_fettsaeuren", 47], ["wasser", 2400],
    ["vitamin_a", 600], ["vitamin_b1", 0.9], ["vitamin_b2", 0.9],
    ["vitamin_b6", 1.0], ["vitamin_b12", 1.8], ["vitamin_c", 45],
    ["vitamin_d", 15], ["vitamin_e", 11], ["folsaeure", 300],
    ["niacin", 12],
    ["calcium", 1300], ["eisen", 8], ["magnesium", 240],
    ["kalium", 2500], ["natrium", 1500], ["zink", 8],
    ["phosphor", 1250], ["jod", 120],
  ]),
  b("10-13", "w", [
    ["energie", 1900], ["eiweiss", 36], ["fett", 63], ["kohlenhydrate", 238],
    ["ballaststoffe", 26], ["zucker", 48], ["gesaettigte_fettsaeuren", 21],
    ["ungesaettigte_fettsaeuren", 42], ["wasser", 2100],
    ["vitamin_a", 600], ["vitamin_b1", 0.9], ["vitamin_b2", 0.9],
    ["vitamin_b6", 1.0], ["vitamin_b12", 1.8], ["vitamin_c", 45],
    ["vitamin_d", 15], ["vitamin_e", 11], ["folsaeure", 300],
    ["niacin", 12],
    ["calcium", 1300], ["eisen", 8], ["magnesium", 240],
    ["kalium", 2300], ["natrium", 1500], ["zink", 8],
    ["phosphor", 1250], ["jod", 120],
  ]),
  b("13-15", "m", [
    ["energie", 2400], ["eiweiss", 46], ["fett", 80], ["kohlenhydrate", 300],
    ["ballaststoffe", 31], ["zucker", 60], ["gesaettigte_fettsaeuren", 27],
    ["ungesaettigte_fettsaeuren", 53], ["wasser", 3300],
    ["vitamin_a", 900], ["vitamin_b1", 1.2], ["vitamin_b2", 1.3],
    ["vitamin_b6", 1.3], ["vitamin_b12", 2.4], ["vitamin_c", 75],
    ["vitamin_d", 15], ["vitamin_e", 15], ["folsaeure", 400],
    ["niacin", 16],
    ["calcium", 1300], ["eisen", 11], ["magnesium", 410],
    ["kalium", 3000], ["natrium", 1500], ["zink", 11],
    ["phosphor", 1250], ["jod", 150],
  ]),
  b("13-15", "w", [
    ["energie", 2000], ["eiweiss", 46], ["fett", 67], ["kohlenhydrate", 250],
    ["ballaststoffe", 26], ["zucker", 50], ["gesaettigte_fettsaeuren", 22],
    ["ungesaettigte_fettsaeuren", 45], ["wasser", 2300],
    ["vitamin_a", 700], ["vitamin_b1", 1.0], ["vitamin_b2", 1.0],
    ["vitamin_b6", 1.2], ["vitamin_b12", 2.4], ["vitamin_c", 65],
    ["vitamin_d", 15], ["vitamin_e", 15], ["folsaeure", 400],
    ["niacin", 14],
    ["calcium", 1300], ["eisen", 15], ["magnesium", 360],
    ["kalium", 2300], ["natrium", 1500], ["zink", 9],
    ["phosphor", 1250], ["jod", 150],
  ]),
  b("15-19", "m", [
    ["energie", 2800], ["eiweiss", 56], ["fett", 93], ["kohlenhydrate", 350],
    ["ballaststoffe", 38], ["zucker", 70], ["gesaettigte_fettsaeuren", 31],
    ["ungesaettigte_fettsaeuren", 62], ["wasser", 3700],
    ["vitamin_a", 900], ["vitamin_b1", 1.2], ["vitamin_b2", 1.3],
    ["vitamin_b6", 1.3], ["vitamin_b12", 2.4], ["vitamin_c", 90],
    ["vitamin_d", 15], ["vitamin_e", 15], ["folsaeure", 400],
    ["niacin", 16],
    ["calcium", 1300], ["eisen", 11], ["magnesium", 420],
    ["kalium", 3400], ["natrium", 1500], ["zink", 11],
    ["phosphor", 1250], ["jod", 150],
  ]),
  b("15-19", "w", [
    ["energie", 2200], ["eiweiss", 46], ["fett", 73], ["kohlenhydrate", 275],
    ["ballaststoffe", 25], ["zucker", 55], ["gesaettigte_fettsaeuren", 24],
    ["ungesaettigte_fettsaeuren", 49], ["wasser", 2700],
    ["vitamin_a", 700], ["vitamin_b1", 1.1], ["vitamin_b2", 1.1],
    ["vitamin_b6", 1.2], ["vitamin_b12", 2.4], ["vitamin_c", 75],
    ["vitamin_d", 15], ["vitamin_e", 15], ["folsaeure", 400],
    ["niacin", 14],
    ["calcium", 1300], ["eisen", 15], ["magnesium", 360],
    ["kalium", 2600], ["natrium", 1500], ["zink", 9],
    ["phosphor", 1250], ["jod", 150],
  ]),
  b("19-25", "m", [
    ["energie", 2600], ["eiweiss", 56], ["fett", 87], ["kohlenhydrate", 325],
    ["ballaststoffe", 38], ["zucker", 65], ["gesaettigte_fettsaeuren", 29],
    ["ungesaettigte_fettsaeuren", 58], ["wasser", 3700],
    ["vitamin_a", 900], ["vitamin_b1", 1.2], ["vitamin_b2", 1.3],
    ["vitamin_b6", 1.3], ["vitamin_b12", 2.4], ["vitamin_c", 90],
    ["vitamin_d", 15], ["vitamin_e", 15], ["folsaeure", 400],
    ["niacin", 16],
    ["calcium", 1000], ["eisen", 8], ["magnesium", 400],
    ["kalium", 3400], ["natrium", 1500], ["zink", 11],
    ["phosphor", 700], ["jod", 150],
  ]),
  b("19-25", "w", [
    ["energie", 2000], ["eiweiss", 46], ["fett", 67], ["kohlenhydrate", 250],
    ["ballaststoffe", 25], ["zucker", 50], ["gesaettigte_fettsaeuren", 22],
    ["ungesaettigte_fettsaeuren", 45], ["wasser", 2700],
    ["vitamin_a", 700], ["vitamin_b1", 1.1], ["vitamin_b2", 1.1],
    ["vitamin_b6", 1.3], ["vitamin_b12", 2.4], ["vitamin_c", 75],
    ["vitamin_d", 15], ["vitamin_e", 15], ["folsaeure", 400],
    ["niacin", 14],
    ["calcium", 1000], ["eisen", 18], ["magnesium", 310],
    ["kalium", 2600], ["natrium", 1500], ["zink", 8],
    ["phosphor", 700], ["jod", 150],
  ]),
  b("25-51", "m", [
    ["energie", 2500], ["eiweiss", 56], ["fett", 83], ["kohlenhydrate", 313],
    ["ballaststoffe", 38], ["zucker", 63], ["gesaettigte_fettsaeuren", 28],
    ["ungesaettigte_fettsaeuren", 55], ["wasser", 3700],
    ["vitamin_a", 900], ["vitamin_b1", 1.2], ["vitamin_b2", 1.3],
    ["vitamin_b6", 1.3], ["vitamin_b12", 2.4], ["vitamin_c", 90],
    ["vitamin_d", 15], ["vitamin_e", 15], ["folsaeure", 400],
    ["niacin", 16],
    ["calcium", 1000], ["eisen", 8], ["magnesium", 420],
    ["kalium", 3400], ["natrium", 1500], ["zink", 11],
    ["phosphor", 700], ["jod", 150],
  ]),
  b("25-51", "w", [
    ["energie", 2000], ["eiweiss", 46], ["fett", 67], ["kohlenhydrate", 250],
    ["ballaststoffe", 25], ["zucker", 50], ["gesaettigte_fettsaeuren", 22],
    ["ungesaettigte_fettsaeuren", 45], ["wasser", 2700],
    ["vitamin_a", 700], ["vitamin_b1", 1.1], ["vitamin_b2", 1.1],
    ["vitamin_b6", 1.3], ["vitamin_b12", 2.4], ["vitamin_c", 75],
    ["vitamin_d", 15], ["vitamin_e", 15], ["folsaeure", 400],
    ["niacin", 14],
    ["calcium", 1000], ["eisen", 18], ["magnesium", 320],
    ["kalium", 2600], ["natrium", 1500], ["zink", 8],
    ["phosphor", 700], ["jod", 150],
  ]),
  b("51-65", "m", [
    ["energie", 2200], ["eiweiss", 56], ["fett", 73], ["kohlenhydrate", 275],
    ["ballaststoffe", 30], ["zucker", 55], ["gesaettigte_fettsaeuren", 24],
    ["ungesaettigte_fettsaeuren", 49], ["wasser", 3700],
    ["vitamin_a", 900], ["vitamin_b1", 1.2], ["vitamin_b2", 1.3],
    ["vitamin_b6", 1.7], ["vitamin_b12", 2.4], ["vitamin_c", 90],
    ["vitamin_d", 15], ["vitamin_e", 15], ["folsaeure", 400],
    ["niacin", 16],
    ["calcium", 1000], ["eisen", 8], ["magnesium", 420],
    ["kalium", 3400], ["natrium", 1500], ["zink", 11],
    ["phosphor", 700], ["jod", 150],
  ]),
  b("51-65", "w", [
    ["energie", 1800], ["eiweiss", 46], ["fett", 60], ["kohlenhydrate", 225],
    ["ballaststoffe", 21], ["zucker", 45], ["gesaettigte_fettsaeuren", 20],
    ["ungesaettigte_fettsaeuren", 40], ["wasser", 2700],
    ["vitamin_a", 700], ["vitamin_b1", 1.1], ["vitamin_b2", 1.1],
    ["vitamin_b6", 1.5], ["vitamin_b12", 2.4], ["vitamin_c", 75],
    ["vitamin_d", 15], ["vitamin_e", 15], ["folsaeure", 400],
    ["niacin", 14],
    ["calcium", 1200], ["eisen", 8], ["magnesium", 320],
    ["kalium", 2600], ["natrium", 1500], ["zink", 8],
    ["phosphor", 700], ["jod", 150],
  ]),
  b("65+", "m", [
    ["energie", 2000], ["eiweiss", 56], ["fett", 67], ["kohlenhydrate", 250],
    ["ballaststoffe", 30], ["zucker", 50], ["gesaettigte_fettsaeuren", 22],
    ["ungesaettigte_fettsaeuren", 45], ["wasser", 3700],
    ["vitamin_a", 900], ["vitamin_b1", 1.2], ["vitamin_b2", 1.3],
    ["vitamin_b6", 1.7], ["vitamin_b12", 2.4], ["vitamin_c", 90],
    ["vitamin_d", 20], ["vitamin_e", 15], ["folsaeure", 400],
    ["niacin", 16],
    ["calcium", 1200], ["eisen", 8], ["magnesium", 420],
    ["kalium", 3400], ["natrium", 1500], ["zink", 11],
    ["phosphor", 700], ["jod", 150],
  ]),
  b("65+", "w", [
    ["energie", 1600], ["eiweiss", 46], ["fett", 53], ["kohlenhydrate", 200],
    ["ballaststoffe", 21], ["zucker", 40], ["gesaettigte_fettsaeuren", 18],
    ["ungesaettigte_fettsaeuren", 35], ["wasser", 2700],
    ["vitamin_a", 700], ["vitamin_b1", 1.1], ["vitamin_b2", 1.1],
    ["vitamin_b6", 1.5], ["vitamin_b12", 2.4], ["vitamin_c", 75],
    ["vitamin_d", 20], ["vitamin_e", 15], ["folsaeure", 400],
    ["niacin", 14],
    ["calcium", 1200], ["eisen", 8], ["magnesium", 320],
    ["kalium", 2600], ["natrium", 1500], ["zink", 8],
    ["phosphor", 700], ["jod", 150],
  ]),
];

// ═══════════════════════════════════════════════════════════════
// Assembled standards
// ═══════════════════════════════════════════════════════════════

export const REFERENCE_STANDARDS: ReferenceStandard[] = [
  {
    id: "dge",
    name: "Deutsche Gesellschaft für Ernährung",
    shortName: "DGE",
    description: "Referenzwerte der Deutschen Gesellschaft für Ernährung — Grundlage der Ernährungsberatung in Deutschland.",
    country: "DE",
    edition: "2024",
    brackets: DGE_BRACKETS,
  },
  {
    id: "oege",
    name: "Österreichische Gesellschaft für Ernährung",
    shortName: "ÖGE",
    description: "Referenzwerte der Österreichischen Gesellschaft für Ernährung — orientiert an den DACH-Referenzwerten mit nationalen Anpassungen.",
    country: "AT",
    edition: "2024",
    brackets: OEGE_BRACKETS,
  },
  {
    id: "sge",
    name: "Schweizerische Gesellschaft für Ernährung",
    shortName: "SGE",
    description: "Referenzwerte der Schweizerischen Gesellschaft für Ernährung — basierend auf den DACH-Referenzwerten mit Schweizer Empfehlungen.",
    country: "CH",
    edition: "2024",
    brackets: SGE_BRACKETS,
  },
  {
    id: "rda",
    name: "Recommended Dietary Allowances",
    shortName: "RDA",
    description: "US-amerikanische Referenzwerte (Dietary Reference Intakes) der National Academies of Sciences.",
    country: "US",
    edition: "2024",
    brackets: RDA_BRACKETS,
  },
];
