# Operation Prodi Design Audit - 2026-04-27

## Summary

This audit reviewed the key clinic-facing workflows with a clinic usability lens: app shell, dashboard, nutrition database, recipes, meal planning, patients, reports, practice operations, institution workflows, API/export, and database status.

Evidence captured:
- 30 unauthenticated/local-bypass screenshots in `.audit/design-screenshots/`.
- 5 authenticated spot-check screenshots in `.audit/design-screenshots-auth/`.
- Mobile overflow checks at 390 px viewport.
- Console/server observations from the capture pass.

Overall: the app has a coherent shadcn-based operational foundation and the route coverage matches the clinic-first product direction. The biggest design risks are mobile/tablet overflow, weak prioritization in dense clinical workspaces, default-looking neutral visual language, and runtime degradation that users experience as broken or unreliable surfaces.

## High Severity

### 1. Mobile layout overflows on nearly every key route

Evidence:
- Screenshot examples: `.audit/design-screenshots/dashboard-mobile.png`, `.audit/design-screenshots/lebensmittel-mobile.png`, `.audit/design-screenshots/rezepte-mobile.png`.
- 390 px viewport overflow measurements:
  - `/lebensmittel`: `scrollWidth 1163`, overflow `773`.
  - `/institution/menueplaene`: `scrollWidth 695`, overflow `305`.
  - `/abrechnung`: `scrollWidth 631`, overflow `241`.
  - Most other routes: `scrollWidth 542`, overflow `152`.

Impact:
- Clinical users on tablets or narrow browser panes get horizontal scrolling before doing any work.
- Header actions and food tables push the viewport wider, making mobile screenshots and touch use feel broken.

Likely causes:
- App shell header keeps global search and PWA status visible in one row at all widths: `app/(app)/layout.tsx`.
- `PageHeader` uses non-wrapping `flex items-center justify-between`: `components/page-header.tsx`.
- Food database controls/table are allowed to define page width rather than scrolling inside a contained region: `app/(app)/lebensmittel/lebensmittel-client.tsx`.

Recommended fix:
- Make the app header responsive: hide or icon-collapse `PwaStatus` under small widths and let global search shrink with `min-w-0`.
- Update `PageHeader` to stack actions below title on mobile and use wrapping/action menus when there are 3+ actions.
- Wrap wide tables in horizontal scroll containers that do not increase document width; for `/lebensmittel`, provide a mobile card/list result view or column-priority table.

### 2. The food database is too wide and table-first for clinical lookup on small screens

Evidence:
- `.audit/design-screenshots/lebensmittel-mobile.png` renders at 1163 px wide for a 390 px target.
- The first screen contains mode tabs, search, category, source, count, and a dense nutrient table before a user can comfortably act.

Impact:
- Food lookup is one of the core PRODI replacement workflows. It needs to feel fast and precise in counseling contexts, not spreadsheet-bound on narrow screens.
- Nutrient values are useful, but the current mobile presentation hides task hierarchy: identify food, inspect source/category, compare nutrients, then act.

Recommended fix:
- Keep the desktop table, but add a mobile result card with primary fields: name, aliases, source, category, kcal, protein/fat/KH, Inari Score.
- Move secondary actions such as alias management into a row menu or detail drawer on mobile.
- Make search mode controls a compact segmented control with horizontal scrolling inside its own container.

### 3. Patient overview mixes patient management with demo/admin tooling

Evidence:
- `.audit/design-screenshots/patienten-mobile.png`.
- The patient list route places eGK demo tooling, mail merge composition, birthday list, and only then patient results/empty state.
- During one capture pass, `/patienten` also logged a hydration mismatch tied to the eGK events section changing between server and client render.

Impact:
- A clinic user arriving at “Patienten” expects patient search, patient list, recent activity, and intake actions first.
- Demo eGK and mail merge are valuable, but they currently dominate the primary patient management surface and bury the core task.

Recommended fix:
- Reprioritize `/patienten`: search/filter and patient list should be the first operational block.
- Move eGK demo into an intake panel, drawer, or separate “Patient aufnehmen” workflow.
- Move mail merge into a dedicated “Serienbriefe” route or collapsible secondary card.
- Fix the hydration mismatch by ensuring the initial eGK event/render state is stable between server and client.

## Medium Severity

### 4. App shell feels generic and not yet clinic-grade

Evidence:
- `.audit/design-screenshots/dashboard-desktop.png`.
- The sidebar and cards are consistent, but the visual language is close to default neutral shadcn.

Impact:
- The product is broad and clinically serious, but the first impression does not yet communicate clinical nutrition depth or institutional reliability.

Recommended fix:
- Introduce a small design-token layer for clinical status, nutrition metrics, risk states, and institution workflows.
- Use color sparingly for meaning: allergen/risk, diet compliance, order status, nutrient gaps, and source trust.
- Keep the restrained layout, but add stronger hierarchy through section density, status bands, and consistent metric treatments.

### 5. Dashboard empty state is not action-oriented enough

Evidence:
- `.audit/design-screenshots/dashboard-desktop.png`, `.audit/design-screenshots/dashboard-mobile.png`.
- Empty metrics show zeros, but there is no guided “next best action” or setup status beyond quick action buttons.

Impact:
- For demos, onboarding, or first clinic workspace setup, the dashboard reads as unused rather than ready.

Recommended fix:
- Add a setup/progress panel when data is empty: create patient, import BLS/custom foods, create recipe, create first plan, schedule appointment.
- Keep the KPI row, but explain zero states with clinical next actions.

### 6. Institution workflows have useful structure but weak operational state hierarchy

Evidence:
- `.audit/design-screenshots/institution-krankenhaus-mobile.png`, `.audit/design-screenshots/institution-menueplaene-desktop.png`.
- Hospital workflow shows metrics, filters, tabs, and empty states, but the operational sequence is not visually prioritized.

Impact:
- Inpatient food service workflows need immediate answers: which service window, which station, which orders are unsafe/pending, what needs kitchen action.

Recommended fix:
- Put service window/station/status into a compact sticky operations bar.
- Promote exceptions and pending unsafe orders above general counts.
- Use stronger status styling for order safety, kitchen readiness, tray-card readiness, and missing menu plans.

### 7. Reports and API/export surfaces degrade quietly when data or APIs are missing

Evidence:
- `.audit/design-screenshots/berichte-mobile.png` shows a generic missing-plan state.
- `/api-export` rendered but `/api/export-jobs` returned 500 during capture.
- Server logs also showed `/datenbank` missing `data_source_events` and `food_reference_replacements` tables in this environment.

Impact:
- Admin and export workflows are trust surfaces. Silent or generic failure states make the app feel unreliable.

Recommended fix:
- Replace generic empty states with explicit prerequisites and recovery actions.
- For export history, show an inline warning if the history endpoint fails rather than relying only on toast.
- For database status, clearly distinguish “not configured in this environment” from genuine production errors.

## Low Severity

### 8. Header/status controls compete with task content

Evidence:
- Mobile overflow offender: `PWA online` badge in the header contributes to global 152 px overflow on many pages.

Recommended fix:
- On mobile, replace `PWA online` text with a status icon and tooltip/sheet detail.
- Consider moving status into user/menu area on desktop as well.

### 9. Repeated cards are spacious for high-frequency clinical work

Evidence:
- Meal plan slots and institution metric cards consume significant vertical space in empty/default states.

Recommended fix:
- Keep spacious defaults for setup, but add dense mode patterns for clinical worklists: compact rows, sticky summaries, and condensed cards.

### 10. Some labels and values need clinical precision cleanup

Evidence:
- Mixed labels such as `KH`, `Eiweiss`, `Patient:in`, and `Inari Ernährungszentrum` appear across core workflows.

Recommended fix:
- Standardize German clinical terminology and typography: `Eiweiß`, `Kohlenhydrate` or consistently `KH`, `Patient:in` vs `Patient`, and organization naming.

## Prioritized Backlog

Quick wins:
- Make `PageHeader` responsive and wrapping.
- Collapse or hide `PwaStatus` text on mobile.
- Contain all tables with `overflow-x-auto` and `min-w-max` inside the table wrapper, not the page.
- Add inline error states for failed export history and database lifecycle fetches.

Medium changes:
- Redesign `/lebensmittel` mobile results as cards with priority nutrient fields.
- Reorder `/patienten` around patient search/list first; move eGK demo and mail merge out of the primary flow.
- Add empty-state onboarding actions to the dashboard.

Larger design-system work:
- Define clinic/nutrition status tokens and reusable metric/status components.
- Create dense worklist patterns for institution and patient workflows.
- Add visual regression checks for 390 px, 768 px, and desktop widths to prevent document-level horizontal overflow.

## Validation Notes

Commands and checks performed:
- Started dev server with `NEXT_PUBLIC_DISABLE_AUTH_FOR_TESTING=true npm run dev`.
- Captured screenshots with Playwright/Chromium across the key workflow routes.
- Ran an authenticated spot-check capture using `tests/.auth/user.json`.
- Measured mobile document width at 390 px viewport.

Observed environment/runtime issues:
- `/patienten` logged a hydration mismatch in the unauthenticated/local-bypass capture pass.
- `/api/export-jobs` returned 500 during both unauthenticated and authenticated capture passes.
- Institution pages logged missing auth session warnings under auth bypass but still rendered fallback UI.
- `/datenbank` logged missing table warnings for lifecycle/replacement tables in the current environment.
- Food browser queries intermittently timed out in authenticated capture.
