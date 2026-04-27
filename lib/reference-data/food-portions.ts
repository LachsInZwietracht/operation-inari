/**
 * Curated German food portion sizes.
 *
 * Matched to BLS food groups and specific BLS codes.
 * Portion weights are based on DGE and common German clinical nutrition references.
 */

export interface PortionTemplate {
  match: {
    blsCode?: string;
    blsPrefix?: string;
    foodGroupId?: string;
  };
  portions: Array<{ label: string; amountGrams: number }>;
}

export const PORTION_TEMPLATES: PortionTemplate[] = [
  // ── Bread & cereals (fg_B) ──────────────────────────────────────────
  {
    match: { foodGroupId: "fg_B" },
    portions: [
      { label: "1 Scheibe Brot", amountGrams: 40 },
      { label: "1 Scheibe dünn", amountGrams: 25 },
      { label: "1 Brötchen", amountGrams: 50 },
      { label: "1 Scheibe Toast", amountGrams: 25 },
      { label: "1 Portion Müsli", amountGrams: 60 },
    ],
  },

  // ── Cereals, flour, starch (fg_C) ──────────────────────────────────
  {
    match: { foodGroupId: "fg_C" },
    portions: [
      { label: "1 Portion gekocht", amountGrams: 200 },
      { label: "1 EL roh", amountGrams: 15 },
      { label: "1 Tasse roh", amountGrams: 80 },
    ],
  },

  // ── Vegetables (fg_G) ──────────────────────────────────────────────
  {
    match: { foodGroupId: "fg_G" },
    portions: [
      { label: "1 Portion", amountGrams: 150 },
      { label: "1 Handvoll", amountGrams: 75 },
      { label: "1 Beilagenportion", amountGrams: 200 },
    ],
  },

  // ── Specific vegetables ────────────────────────────────────────────
  {
    match: { blsPrefix: "G110" },
    portions: [
      { label: "1 Tomate mittel", amountGrams: 120 },
    ],
  },
  {
    match: { blsPrefix: "G040" },
    portions: [
      { label: "1 Karotte mittel", amountGrams: 70 },
    ],
  },
  {
    match: { blsPrefix: "G091" },
    portions: [
      { label: "1 Paprika", amountGrams: 150 },
    ],
  },
  {
    match: { blsPrefix: "G032" },
    portions: [
      { label: "1 Gurke mittel", amountGrams: 400 },
      { label: "5 Scheiben Gurke", amountGrams: 50 },
    ],
  },
  {
    match: { blsPrefix: "G116" },
    portions: [
      { label: "1 Zwiebel mittel", amountGrams: 80 },
    ],
  },
  {
    match: { blsPrefix: "G046" },
    portions: [
      { label: "1 Kartoffel mittel", amountGrams: 80 },
      { label: "1 Portion Kartoffeln", amountGrams: 200 },
    ],
  },

  // ── Fruit (fg_O) ──────────────────────────────────────────────────
  {
    match: { foodGroupId: "fg_O" },
    portions: [
      { label: "1 Portion", amountGrams: 150 },
      { label: "1 Handvoll", amountGrams: 75 },
    ],
  },
  {
    match: { blsPrefix: "O010" },
    portions: [
      { label: "1 Apfel mittel", amountGrams: 150 },
    ],
  },
  {
    match: { blsPrefix: "O020" },
    portions: [
      { label: "1 Banane mittel", amountGrams: 120 },
    ],
  },
  {
    match: { blsPrefix: "O060" },
    portions: [
      { label: "1 Orange mittel", amountGrams: 170 },
    ],
  },
  {
    match: { blsPrefix: "O024" },
    portions: [
      { label: "1 Birne mittel", amountGrams: 160 },
    ],
  },
  {
    match: { blsPrefix: "O115" },
    portions: [
      { label: "1 Kiwi", amountGrams: 75 },
    ],
  },
  {
    match: { blsPrefix: "O030" },
    portions: [
      { label: "1 Portion Erdbeeren", amountGrams: 150 },
    ],
  },
  {
    match: { blsPrefix: "O112" },
    portions: [
      { label: "1 Portion Weintrauben", amountGrams: 125 },
    ],
  },
  {
    match: { blsPrefix: "O093" },
    portions: [
      { label: "1 Pfirsich", amountGrams: 150 },
    ],
  },
  {
    match: { blsPrefix: "O014" },
    portions: [
      { label: "1 Aprikose", amountGrams: 45 },
    ],
  },
  {
    match: { blsPrefix: "O098" },
    portions: [
      { label: "1 Pflaume", amountGrams: 45 },
    ],
  },
  {
    match: { blsPrefix: "O054" },
    portions: [
      { label: "1 Mandarine", amountGrams: 60 },
    ],
  },

  // ── Dairy (fg_M) ──────────────────────────────────────────────────
  {
    match: { foodGroupId: "fg_M" },
    portions: [
      { label: "1 Glas Milch", amountGrams: 200 },
      { label: "1 Becher Joghurt", amountGrams: 150 },
      { label: "1 Scheibe Käse", amountGrams: 25 },
      { label: "1 Portion Quark", amountGrams: 150 },
    ],
  },

  // ── Meat (fg_F) ────────────────────────────────────────────────────
  {
    match: { foodGroupId: "fg_F" },
    portions: [
      { label: "1 Portion", amountGrams: 150 },
      { label: "1 Steak", amountGrams: 200 },
      { label: "1 Scheibe Aufschnitt", amountGrams: 20 },
      { label: "1 Schnitzel", amountGrams: 150 },
    ],
  },

  // ── Sausage (fg_W) ────────────────────────────────────────────────
  {
    match: { foodGroupId: "fg_W" },
    portions: [
      { label: "1 Portion", amountGrams: 150 },
      { label: "1 Scheibe Wurst", amountGrams: 20 },
      { label: "1 Paar Würstchen", amountGrams: 100 },
    ],
  },

  // ── Fish (fg_T) ────────────────────────────────────────────────────
  {
    match: { foodGroupId: "fg_T" },
    portions: [
      { label: "1 Filet", amountGrams: 125 },
      { label: "1 Portion", amountGrams: 150 },
    ],
  },

  // ── Eggs (fg_E) ────────────────────────────────────────────────────
  {
    match: { foodGroupId: "fg_E" },
    portions: [
      { label: "1 Ei Gr. M", amountGrams: 58 },
      { label: "1 Ei Gr. L", amountGrams: 63 },
      { label: "1 Ei Gr. S", amountGrams: 48 },
    ],
  },

  // ── Fats & oils (fg_P) ────────────────────────────────────────────
  {
    match: { foodGroupId: "fg_P" },
    portions: [
      { label: "1 EL", amountGrams: 10 },
      { label: "1 TL", amountGrams: 5 },
      { label: "1 Streichportion", amountGrams: 5 },
      { label: "1 Portion Butter", amountGrams: 20 },
    ],
  },

  // ── Beverages (fg_N) ──────────────────────────────────────────────
  {
    match: { foodGroupId: "fg_N" },
    portions: [
      { label: "1 Glas (200 ml)", amountGrams: 200 },
      { label: "1 Tasse (150 ml)", amountGrams: 150 },
      { label: "1 Becher (250 ml)", amountGrams: 250 },
      { label: "1 Flasche (330 ml)", amountGrams: 330 },
      { label: "1 Flasche (500 ml)", amountGrams: 500 },
    ],
  },

  // ── Legumes (fg_H) ────────────────────────────────────────────────
  {
    match: { foodGroupId: "fg_H" },
    portions: [
      { label: "1 Portion gekocht", amountGrams: 150 },
      { label: "1 EL roh", amountGrams: 20 },
    ],
  },

  // ── Nuts & seeds (fg_S) ────────────────────────────────────────────
  {
    match: { foodGroupId: "fg_S" },
    portions: [
      { label: "1 Handvoll", amountGrams: 30 },
      { label: "1 EL", amountGrams: 10 },
      { label: "1 Portion", amountGrams: 25 },
    ],
  },

  // ── Sweets & snacks (fg_Z) ────────────────────────────────────────
  {
    match: { foodGroupId: "fg_Z" },
    portions: [
      { label: "1 Stück", amountGrams: 25 },
      { label: "1 Riegel", amountGrams: 40 },
      { label: "1 Kugel Eis", amountGrams: 50 },
    ],
  },

  // ── Cakes & pastries (fg_K) ────────────────────────────────────────
  {
    match: { foodGroupId: "fg_K" },
    portions: [
      { label: "1 Stück Kuchen", amountGrams: 100 },
      { label: "1 Stück Torte", amountGrams: 120 },
      { label: "1 Keks", amountGrams: 10 },
    ],
  },

  // ── Condiments & sauces (fg_R) ─────────────────────────────────────
  {
    match: { foodGroupId: "fg_R" },
    portions: [
      { label: "1 EL", amountGrams: 15 },
      { label: "1 TL", amountGrams: 5 },
      { label: "1 Portion Soße", amountGrams: 50 },
    ],
  },

  // ── Ready meals (fg_Q) ────────────────────────────────────────────
  {
    match: { foodGroupId: "fg_Q" },
    portions: [
      { label: "1 Portion", amountGrams: 300 },
    ],
  },
];
