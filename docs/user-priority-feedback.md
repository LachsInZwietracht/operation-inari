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
   - _Status (2026-08-02):_ Partially addressed for patient intake. A practitioner can create a shareable invite link (plus QR) and the invited person completes an 11-step mobile questionnaire without logging in; applying the submission creates or updates the patient. This replaces the clinical admin form as the first touchpoint. See `documentation.md` section 4.25. The practitioner-side setup wizard and general workflow simplification remain open.
   - _Update (2026-08-12):_ Practitioner review now supports corrections, internal notes, deterministic contradiction prompts, and a traceable discard action before apply. The dashboard leads with a seven-day calendar and a prioritized list of returned questionnaires, open plans, and long-uncontacted patients instead of placing appointments at the bottom. See `documentation.md` sections 4.1, 4.8, and 4.25.
   - _Update (2026-08-25):_ The patient nutrition area now separates decision-making from editing: Planstatus combines goals, current measurements, an explicitly labelled projection, real dated plan coverage, and consented live client feedback before the full planner is opened under Plan bearbeiten. See `documentation.md` section 4.17.
   - _Update (2026-08-25):_ The patient week builder now ends with an explicit review and atomic Monday–Sunday handoff instead of a vague final action. It distinguishes blockers from clinical warnings and keeps later changes as revisions. See `documentation.md` section 4.17.
   - _Update (2026-08-27):_ The patient planner now presents **Freigaben** as compact Monday–Sunday handoffs instead of seven visible daily version chains. Counselors edit a complete working week live; **Änderungen vorbereiten** atomically creates its seven private successors while the previously released week remains client-visible. Only **Plan prüfen & freigeben** publishes the whole week. Reusable templates stay separate, and released/historical stands cannot be overwritten. See `documentation.md` section 4.17.
2. **DGE/ÖGE reference values, individually adjustable, with selectable PAL values.** Built-in standards plus per-patient customization, including different activity (PAL) levels.
   - _Status (2026-06-01):_ Live. `/referenzwerte` supports custom profiles, per-nutrient adjustment, DGE/ÖGE/SGE/RDA comparison, and per-patient PAL assignment in the patient energy panel. Implementation details live in `documentation.md` sections 4.6 and 4.6.1; schema/ETL details live in `docs/database-guide.md`.
3. **Selectable / clearly visible source database per food.** Let users choose which database is used (as PRODI does) or otherwise make the source clearly visible on each food, because available nutrients differ per database.
   - _Status (2026-06-03):_ Live. The foods browser has a persisted active-source preference, food rows and details show source coverage, missing nutrients are distinguished from measured zero values, and `/datenbank` supports organization-level source activation for entitled sources. See `documentation.md` sections 4.2 and 4.12.
   - _Update (2026-08-12):_ Two coverage gaps closed after the Open Food Facts import grew the catalog to ~101k foods. The default browse now leads with the curated BLS/SFK catalog instead of branded OFF products (OFF stays fully searchable), and nutrient groups the source does not measure keep their tab with an explicit "keine Daten" message instead of disappearing.
4. **Sort and filter foods by individual nutrients.** E.g. sort foods by protein, or filter foods with `> 10 g protein / 100 g`. Sorting and threshold filtering are both expected.
   - _Status (2026-06-03):_ Live. `/lebensmittel` supports nutrient selection, ascending/descending sort, and min/max thresholds per 100 g across the catalog. Route behavior is documented in `documentation.md` section 4.2; the backing RPC is documented in `docs/database-guide.md` section 7.
5. **Add custom foods** not yet present in any database.
   - _Status (2026-08-22):_ Live. `/lebensmittel/neu` creates personal foods with Supabase persistence and local fallback; personal foods are merged into the browser and global search under the authenticated user's RLS scope. See `documentation.md` section 4.2.
6. **Create and save custom recipes.** Optionally link/import an existing recipe database.
   - _Status (2026-08-22):_ Live. `/rezepte/neu` and `/rezepte/[id]/bearbeiten` persist personal recipes, and the recipe overview imports legacy Meal-Master `.mmf`/`.txt` files through an explicit ingredient-review step. See `documentation.md` sections 4.3-4.5.
7. **Timely data updates.** Guarantee that new BLS releases and changed DGE/ÖGE reference values reach the app promptly.
8. **Sensible portion sizes alongside gram amounts.** Offer meaningful portion options per food/food group, not only grams. (Source for portion data is open.)
   - _Status (2026-07-10):_ Data foundation fixed. `etl:portions` had two bugs (1000-row fetch cap, parent-vs-child food-group mismatch) that left `food_portions` empty; after the fix the import yields ~11k curated portion rows across the BLS catalog. Portions surface on food detail, in the Austauschtabellen, and as the realistic-portion cap of the planner's Nährstoff-Lückenfüller. Still open: offering portion options (instead of grams) directly in the meal-plan entry flows.
9. **Export to Word, Excel, and other formats.** Export plans/results; research clinic cloud/software environments and consider API integration. DSGVO/GDPR is even more critical here.
   - _Update (2026-08-16):_ In addition to the existing PDF reports, the planner can now exchange a versioned JSON plan file. The server checks the permitted role and all referenced foods/recipes, records the access, and imports only after a visible preview and explicit draft action. Word/Excel and multi-day interchange remain open.

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
