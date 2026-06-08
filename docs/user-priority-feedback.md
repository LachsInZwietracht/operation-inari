# User Priority Feedback (Top Guideline)

> **Status: #1 product guideline.** This document captures direct feedback from a
> practicing PRODI user describing what our software should be able to do. Until
> further notice, this feedback is the single most important reference for
> prioritization. When in doubt about what to build or polish next, align with the
> requirements below before anything else.

Source: anonymized and normalized summary of practitioner feedback received
2026-05-30. The original correspondence is intentionally not stored in the
public repository.

## Requirement Checklist (must-have)

These are the user's "Was ich wichtig finde" points, treated as required product capabilities.

1. **Intuitive design, low onboarding effort.** Keep workflows simple and motivating; minimize training time.
2. **DGE/ÖGE reference values, individually adjustable, with selectable PAL values.** Built-in standards plus per-patient customization, including different activity (PAL) levels.
   - _Status (2026-06-01):_ Custom profiles now support **per-nutrient scaling via sliders** in the `/referenzwerte` → "Eigene Profile" editor: each nutrient can be scaled relative to its standard base (live `%` readout, 100 % = base) or set to an exact Zielwert, making individual adjustment (e.g. higher protein, lower sodium) intuitive. Overrides remain absolute amounts (no schema change); read-only summaries tag each override with its `%` delta.
   - _Status (2026-05-31):_ Custom profiles, per-patient standard/life-stage assignment, and selectable PAL are live and now **consolidated into one "Referenzwerte & Energiebedarf" panel** in the patient `Aktivität & Energie` tab. PAL now **persists per patient** (`patient_reference_assignments.pal_value`) and drives the Grundumsatz × PAL = Tagesbedarf readout. All four reference standards (**DGE, ÖGE, SGE, RDA**) are now enabled in the selectors and comparison view (`ENABLED_REFERENCE_STANDARDS` in `lib/reference-metadata.ts`); DGE/ÖGE/SGE follow the jointly published D-A-CH reference values (ÖGE/SGE modeled as DGE with documented national deltas), RDA uses US DRI values. _Note:_ a Supabase instance that already holds only DGE `reference_values` rows must re-run `npm run etl:reference-values` to materialise ÖGE/SGE/RDA; the bundled offline fallback already includes all four.
3. **Selectable / clearly visible source database per food.** Let users choose which database is used (as PRODI does) or otherwise make the source clearly visible on each food, because available nutrients differ per database.
   - _Status (2026-06-01):_ **Largely live.** The foods browser source selector is now a **persisted "Aktive Datenbank"** choice (`useFoodSourcePreference`, `localStorage`, default "Alle Quellen") rather than a throwaway filter, with a Gespeichert badge; each food row shows its own source as a trust-tone badge. The food detail nutrient tables now distinguish **`n. e.` (in dieser Datenquelle nicht erfasst)** from a measured `0`, addressing the user's rationale that databases cover different nutrients. The `/datenbank` page gained a **"Verbundene Datenbanken"** governance card (Aktiv/Tarif per source via `canAccessDataSource`). _Deferred (Phase 2, billing-dependent):_ org-level enable/disable *writes* and a server-backed cross-device default; today the active-database default is per-browser via `localStorage`.
4. **Sort and filter foods by individual nutrients.** E.g. sort foods by protein, or filter foods with `> 10 g protein / 100 g`. Sorting and threshold filtering are both expected.
   - _Status (2026-06-03):_ **Live.** The foods browser (`/lebensmittel`) gained a "Nach Nährstoff sortieren & filtern" panel: pick any nutrient from `NUTRIENT_DEFINITIONS` (grouped by makro/vitamine/mineralstoffe/…), order **höchste/niedrigste zuerst**, and set optional **Min./Max.** thresholds (per 100 g). This runs server-side across the whole catalog via the new `filter_foods_by_nutrient` RPC (`supabase/migrations/20260604000054_filter_foods_by_nutrient.sql`, backed by a `(nutrient_id, amount)` index), composes with the source/category/group filters, and the selected nutrient is shown as a dedicated result column. Locally-held custom foods are filtered and re-sorted client-side to stay consistent. Both required behaviours — sorting and `>`-threshold filtering — are covered.
5. **Add custom foods** not yet present in any database.
6. **Create and save custom recipes.** Optionally link/import an existing recipe database.
7. **Timely data updates.** Guarantee that new BLS releases and changed DGE/ÖGE reference values reach the app promptly.
8. **Sensible portion sizes alongside gram amounts.** Offer meaningful portion options per food/food group, not only grams. (Source for portion data is open.)
9. **Export to Word, Excel, and other formats.** Export plans/results; research clinic cloud/software environments and consider API integration. DSGVO/GDPR is even more critical here.

## Requirement Checklist (high-interest, feasibility TBD)

These are the user's "Was ich noch spannend fände" points, treated as strong differentiators to evaluate.

1. **Preparation-state submenu per food.** Group raw/cooked/steamed variants (separate BLS entries) under one food via a dropdown for clarity.
2. **Food category/tag system for intolerances.** Tag foods (contains lactose, fructose, etc.) and build recommended / not-recommended lists for intolerances.
3. **Condition- and goal-specific info & highlighting.** For patients/clinics: short fact pages per condition (e.g. IBD guidance), naming relevant foods/nutrients or amounts; or, when a profile is selected (disease, or goal like athlete), color-code and annotate the nutrients that matter for that profile. Requires legal review of what nutrition recommendations we may make for patients.
4. **Cross-platform compatibility.** Windows, Linux, macOS as a web version, plus Android and Apple.

## How To Use This Document

- Treat the must-have checklist as the primary acceptance lens for current work.
- Before starting new feature work, confirm it advances one of these requirements or is required to support them.
- When a requirement is implemented, link the implementing routes/components in `documentation.md` and note status here.
- Re-evaluate priority order only with explicit user direction.
