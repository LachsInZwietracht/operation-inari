# User Priority Feedback (Top Guideline)

> **Status: #1 product guideline.** This document captures direct feedback from a
> practicing PRODI user describing what our software should be able to do. Until
> further notice, this feedback is the single most important reference for
> prioritization. When in doubt about what to build or polish next, align with the
> requirements below before anything else.

Source: email from a PRODI user (received and recorded 2026-05-30).

## Original Email (verbatim, German)

> Ich habe mir nun aber ein paar Gedanken gemacht, was mir zu Prodi und zu einer möglichen neuen App eingefallen ist.
>
> **Was ich wichtig finde:**
>
> - Insgesamt möglichst intuitives Design mit wenig Einarbeitungszeit für die Motivation
> - Referenzwerte sollten nach DGE/ÖGE eingebaut sein, aber auch individuell anpassbar sein. Dabei sollten auch verschiedene PAL-Werte einbezogen werden können
> - Datenbank sollte ausgewählt werden können, die genutzt werden soll (wie auch schon bei Prodi) oder alternativ irgendwo gut sichtbar sein bei den Lebensmitteln. Denn je nach Datenbank werden auch ganz unterschiedliche Nährstoffe berücksichtigt oder eben nicht.
> - Eine Funktion, die es in Prodi gibt und die ich sehr wichtig finde: Sortierung von Lebensmitteln nach einzelnen Inhaltsstoffen, z. B. nach Protein sortiert oder Anzeige von Lebensmitteln, die > 10g Protein/100 g enthalten oder ähnlich (letzteres dann eher Filter als Sortierung)
> - Eigene Lebensmittel einfügen können, falls noch nicht in einer Datenbank vorhanden
> - Eigene Rezepte erstellen und speichern können. Vielleicht auch eine Rezeptdatenbank verlinken, die es schon gibt und die importiert werden kann.
> - Ihr solltet gewährleisten können, dass Updates, wie z. B. der neu erschiene BLS oder auch geänderte Referenzwerte der DGE/ÖGE möglichst zeitnah in eurer App landen
> - Neben Grammangaben sollten sinnvolle Portionsgrößen zur Wahl stehen. Ich weiß hier allerdings gerade keine gute Quelle für. Unterscheidet sich auch je nach Lebensmittel/-gruppe.
> - Export von Plänen, Ergebnissen etc. in Word, Excel und ggf. weitere Programme. Falls ihr mit Kliniken zusammenarbeiten wollt, könnt ihr ggf. auch mal fragen/recherchieren, was die für eine interne Cloud oder Software-Umgebung nutzen. Vielleicht kann man das mittels API (ich weiß nicht, ob ich den Begriff richtig nutze 😊) sogar dort einbinden. Hier wäre dann der Punkt DSGVO auch noch entscheidender als sowieso schon
>
> **Was ich noch spannend fände, aber die Umsetzbarkeit nicht einschätzen kann:**
>
> - bei der Suche nach Lebensmitteln jeweils pro Lebensmittel ein Untermenü anbieten, ob roh, gekocht, gedünstet o.ä.. Findet sich in der BLS-Liste jeweils als eigene Lebensmittel, aber ich fände es übersichtlicher, das eher als Drop-Down-Menü oder so zu haben
> - Lebensmitteln Kategorien zuweisen, z. B. enthält Laktose, Fruktose etc. → oder Listen mit empfehlenswerten oder weniger empfehlenswerten Inhaltsstoffen für Unverträglichkeiten → sicher nicht einfach, aber wäre starkes Feature
> - Falls eure Zielgruppe Erkrankte oder Kliniken umfassen: Infoseiten zu kurzen Facts, z. B. wenn du eine chronisch entzündliche Darmerkrankung hast, solltest du mehr auf dies und jenes achten. Ggf. nur Lebensmittel oder Inhaltsstoffe benennen oder sogar mit Mengen. Allerdings muss man hier auch rechtlich prüfen, inwieweit ihr solche Empfehlungen dann für Kranke machen dürft. Oder bei Auswahl eines entsprechenden Profils (wie bestimmte Krankheit oder Ziel wie Sportler) die interessanten Nährwerte farblich und mit Infos o.ä. hinterlegen, was hier besonders ist
> - Kompatibilität mit Windows, Linux und Mac als Webversion oder eben Android und Apple.

## Requirement Checklist (must-have)

These are the user's "Was ich wichtig finde" points, treated as required product capabilities.

1. **Intuitive design, low onboarding effort.** Keep workflows simple and motivating; minimize training time.
2. **DGE/ÖGE reference values, individually adjustable, with selectable PAL values.** Built-in standards plus per-patient customization, including different activity (PAL) levels.
   - _Status (2026-06-01):_ Custom profiles now support **per-nutrient scaling via sliders** in the `/referenzwerte` → "Eigene Profile" editor: each nutrient can be scaled relative to its standard base (live `%` readout, 100 % = base) or set to an exact Zielwert, making individual adjustment (e.g. higher protein, lower sodium) intuitive. Overrides remain absolute amounts (no schema change); read-only summaries tag each override with its `%` delta.
   - _Status (2026-05-31):_ Custom profiles, per-patient standard/life-stage assignment, and selectable PAL are live and now **consolidated into one "Referenzwerte & Energiebedarf" panel** in the patient `Aktivität & Energie` tab. PAL now **persists per patient** (`patient_reference_assignments.pal_value`) and drives the Grundumsatz × PAL = Tagesbedarf readout. All four reference standards (**DGE, ÖGE, SGE, RDA**) are now enabled in the selectors and comparison view (`ENABLED_REFERENCE_STANDARDS` in `lib/reference-metadata.ts`); DGE/ÖGE/SGE follow the jointly published D-A-CH reference values (ÖGE/SGE modeled as DGE with documented national deltas), RDA uses US DRI values. _Note:_ a Supabase instance that already holds only DGE `reference_values` rows must re-run `npm run etl:reference-values` to materialise ÖGE/SGE/RDA; the bundled offline fallback already includes all four.
3. **Selectable / clearly visible source database per food.** Let users choose which database is used (as PRODI does) or otherwise make the source clearly visible on each food, because available nutrients differ per database.
   - _Status (2026-06-01):_ **Largely live.** The foods browser source selector is now a **persisted "Aktive Datenbank"** choice (`useFoodSourcePreference`, `localStorage`, default "Alle Quellen") rather than a throwaway filter, with a Gespeichert badge; each food row shows its own source as a trust-tone badge. The food detail nutrient tables now distinguish **`n. e.` (in dieser Datenquelle nicht erfasst)** from a measured `0`, addressing the user's rationale that databases cover different nutrients. The `/datenbank` page gained a **"Verbundene Datenbanken"** governance card (Aktiv/Tarif per source via `canAccessDataSource`). _Deferred (Phase 2, billing-dependent):_ org-level enable/disable *writes* and a server-backed cross-device default; today the active-database default is per-browser via `localStorage`.
4. **Sort and filter foods by individual nutrients.** E.g. sort foods by protein, or filter foods with `> 10 g protein / 100 g`. Sorting and threshold filtering are both expected.
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
