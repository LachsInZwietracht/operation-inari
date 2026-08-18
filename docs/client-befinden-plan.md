# Client Check-in and Correlations (M8)

Status: shipped (M8.1–M8.4; migrations `20260818000093`–`…095`). Owner decision record for the wellbeing/context
layer of client mode. Read `docs/client-mode-plan.md` first — this document
assumes the module architecture, the link table and the RLS shape described
there.

## What this is, and what it deliberately is not

The client already writes down what they ate, what they trained and what they
weigh. M8 adds the part that makes those numbers answerable: **how the day
actually went**, plus the context around it (sleep, alcohol), and an evaluation
surface that puts any two of those series next to each other.

**Positioning, and it is a hard constraint, not a preference: the app is an
evaluation tool, not an advisor.** It describes the user's own data back to
them. It does not interpret, recommend, warn or diagnose. Concretely forbidden
in this feature:

- No "you should", no suggestions, no nudges derived from the data.
- No automatic search for correlations, no ranking of pairs, no "we noticed…".
  The user picks the pair; the app computes what was asked for.
- No significance language. No p-values, no "significant", no "proven".
- No normal ranges, target values or reference intervals for wellbeing, mood or
  sleep. There is no "too little sleep" state in this UI.
- No red states, no alerts, no escalation on low mood values.
- No streaks, no scores, no gamification of a mood entry.

Every comparison carries the same fixed line: *Zusammenhang, keine Ursache.*
Interpretation is the counselor's job, and that is exactly the product boundary
that keeps this a documentation tool rather than a medical claim.

This is consistent with what the client surface already does elsewhere —
coverage instead of confidence, missing never counted as zero, no bar that
fills up as an instruction to fill it.

## Decisions

| Question | Decision |
|---|---|
| Score design | One mandatory overall score (1–10) plus three optional sub-scores (Energie, Stimmung, Verdauung, each 1–5) |
| Who decides what is tracked | The client, in `/klient/einstellungen`. No counselor-prescribed trackers in v1 |
| Per-metric control | Three switches per metric: **tracken**, **anzeigen**, **teilen** |
| Counselor visibility | Yes, behind a new `consent_wellbeing` flag *and* the per-metric `shared` switch |
| Evaluation surface | Time-axis chart with a shift control **and** bucket comparison, both user-driven |
| Nutrition metrics in v1 | Energy, the three macros, sugar, fibre, meal count. Micronutrients deferred |
| Training metrics in v1 | Training day yes/no, duration, net kcal |
| Backfilling | Unlimited. Any past date, no "late" marking |
| Water and day note | Stay in `client_food_log_days`. Split accepted, the assembler hides it |

## The metric registry

`lib/client-metrics.ts` is the spine of the whole feature. Every metric —
whether it comes from the check-in, the diary, the training log or the
anthropometrics — is described once, and both the check-in UI and the
evaluation read that description. Adding a metric is a registry entry plus, if
it is self-reported, one column.

```ts
export interface ClientMetric {
  key: string;                    // stable, used as metric_key in preferences
  label: string;                  // German, user-facing
  group: "befinden" | "ernaehrung" | "training" | "koerper";
  unit?: string;
  source: "checkin" | "foodlog" | "workout" | "anthropometrics";
  scale: { min: number; max: number } | "continuous";
  /**
   * Which stretch of time the value describes. Sleep entered on Tuesday
   * describes the night *onto* Tuesday, and the evaluation must know that or
   * it silently mixes cause directions.
   */
  window: "day" | "night-before";
  /** Fixed edges, ordinal grouping, or quartiles of this person's own data. */
  buckets: BucketRule | null;     // null = chartable but not bucketable
  defaults: { tracked: boolean; shown: boolean; shared: boolean };
}
```

### v1 metrics

| Key | Label | Scale | Source | Window | Buckets |
|---|---|---|---|---|---|
| `wellbeing` | Wohlbefinden | 1–10 | checkin | day | 1–4 / 5–6 / 7–8 / 9–10 |
| `energy` | Energie | 1–5 | checkin | day | 1–2 / 3 / 4–5 |
| `mood` | Stimmung | 1–5 | checkin | day | 1–2 / 3 / 4–5 |
| `digestion` | Verdauung | 1–5 | checkin | day | 1–2 / 3 / 4–5 |
| `sleep_minutes` | Schlafdauer | minutes | checkin | night-before | <6 h / 6–7 h / 7–8 h / >8 h |
| `sleep_quality` | Schlafqualität | 1–5 | checkin | night-before | 1–2 / 3 / 4–5 |
| `alcohol_units` | Alkohol | Standardgläser | checkin | day | 0 / 0,5–1 / 1,5–2 / >2 |
| `water_ml` | Wasser | ml | foodlog | day | <1 l / 1–2 l / >2 l |
| `kcal` | Energie (Essen) | kcal | foodlog | day | quartiles |
| `protein_g` `fat_g` `carbs_g` | Makros | g | foodlog | day | quartiles |
| `sugar_g` `fiber_g` | Zucker, Ballaststoffe | g | foodlog | day | quartiles |
| `meal_count` | Mahlzeiten | count | foodlog | day | 1–2 / 3 / 4 / 5+ |
| `training_day` | Trainingstag | 0/1 | workout | day | ja / nein |
| `training_minutes` | Trainingsdauer | minutes | workout | day | quartiles over training days |
| `training_kcal` | Trainingsenergie | kcal | workout | day | quartiles over training days |
| `weight_kg` | Gewicht | kg | anthropometrics | day | **null** |

Weight is chartable but not bucketable on purpose: it is a level that moves over
weeks, so "on days you weighed 82 kg" is not a group of comparable days.

Alcohol is counted in **Standardgläser (10 g ethanol)** and carries no energy.
The kcal of a beer come from the diary entry for that beer; a second energy
figure here would either double-count or contradict it. `foods` has no ethanol
column, so the unit cannot be derived from the catalog and is asked for
directly — the same reasoning that gave water its own column instead of a
catalog item.

Micronutrients are deliberately absent from the picker. Their per-day coverage
is too patchy for day-level comparison; the Verlauf already states micronutrient
averages against reference intakes with an explicit coverage share, which is the
honest framing for them.

## Schema

Two migrations in M8.1, one more in M8.4.

### `client_daily_checkins` (migration `…000093`)

```sql
CREATE TABLE client_daily_checkins (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  checkin_date   DATE NOT NULL,
  wellbeing      SMALLINT CHECK (wellbeing    BETWEEN 1 AND 10),
  energy         SMALLINT CHECK (energy       BETWEEN 1 AND 5),
  mood           SMALLINT CHECK (mood         BETWEEN 1 AND 5),
  digestion      SMALLINT CHECK (digestion    BETWEEN 1 AND 5),
  sleep_minutes  INTEGER  CHECK (sleep_minutes BETWEEN 0 AND 1440),
  sleep_quality  SMALLINT CHECK (sleep_quality BETWEEN 1 AND 5),
  alcohol_units  NUMERIC(4,1) CHECK (alcohol_units BETWEEN 0 AND 50),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (client_user_id, checkin_date)
);
```

Every metric column is nullable and **NULL means unanswered**, which is not the
same as a low value. Nothing in the evaluation may substitute a zero.

A separate table rather than more columns on `client_food_log_days`, for three
reasons: someone can rate a day without logging food, the check-in needs its own
consent area, and the day table belongs to the diary module.

RLS on this table is **owner-only** — `client_user_id = auth.uid()` for select,
insert, update and delete. The counselor gets no policy here at all; see below.

`client_links` gains `consent_wellbeing BOOLEAN NOT NULL DEFAULT FALSE`, and the
existing consent helper gains a `'wellbeing'` branch.

### `client_metric_preferences` (migration `…000094`)

```sql
CREATE TABLE client_metric_preferences (
  client_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  metric_key     TEXT NOT NULL,
  tracked        BOOLEAN NOT NULL DEFAULT TRUE,
  shown          BOOLEAN NOT NULL DEFAULT TRUE,
  shared         BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (client_user_id, metric_key)
);
```

Owner-only RLS, same shape. `metric_key` has no foreign key — the registry lives
in TypeScript, and a row is written only where the user departed from the
registry default. Absence therefore means "default", which keeps the table tiny
and makes a new metric appear with sensible switches for everyone without a
backfill. The accepted cost: changing a default in code changes behaviour for
users who never touched that switch, so defaults are changed only deliberately.

Defaults in v1: `wellbeing` and `sleep_minutes` tracked; sub-scores,
`sleep_quality` and `alcohol_units` off until switched on; everything derived
(diary, training, weight) is always available and has no `tracked` switch — you
cannot untrack a number that is computed from data you already entered. `shown`
and `shared` default to true.

### Why the counselor does not read the table (migration `…000095`, M8.4)

Per-metric sharing is **column-level** filtering, and RLS is row-level. A policy
cannot express "this counselor may see wellbeing but not mood". So:

- The client reads their own rows directly through RLS, wide format.
- The counselor has **no SELECT policy**, and reads exclusively through
  `client_wellbeing_series(patient_id, from_date, to_date)`, `SECURITY DEFINER`,
  which checks the active link and `consent_wellbeing`, then unpivots the
  explicitly enumerated metric columns and emits **long format**:
  `(checkin_date, metric_key, value)`.

Long format is the point: a metric the client has not shared simply produces no
rows. There is no column to null out and forget, and a column added later does
not leak until someone adds it to the enumeration. This follows the precedent
already set by `client_patient_history()` and `client_record_weight()` — where
the answer travels, not the underlying record.

## Time semantics

The single most important modelling rule, because getting it wrong silently
mixes cause directions:

- **Sleep entered on day D describes the night onto D.** The registry says
  `window: "night-before"`, and the UI labels it "Nacht auf Di., 18.8.".
- Food, training, alcohol and the wellbeing score describe day D itself.
- A pairing of two metrics uses each metric's own window as declared. The user
  never sets a lag to get the natural reading; the registry produces it.

On top of that sits the **shift control** (see below), which is exploration, not
correction.

`lib/client-checkin.ts` holds a day-fact assembler that merges check-in row,
diary day (kcal, macros, meal count, water), workout sessions and weight into
one record per date, from which everything else is computed. This is where the
water/notes split stops being visible.

### When a day counts

- A **nutrition** metric counts for a day only if the diary has at least one
  entry that day. An empty day is not a 0 kcal day.
- `sugar_g` and `fiber_g` count only if at least 80 % of that day's energy came
  from foods that carry the nutrient. Barcode products routinely carry neither,
  and summed with catalog foods they are indistinguishable from a food
  containing none. `collectClientDayParts` already computes this share; reuse it.
- A **check-in** metric counts only where the value is not NULL.
- Days that do not count are excluded from averages and drawn as gaps —
  never interpolated, never zero.

## The check-in

Lives **in the diary**, as a card below the day's food, following the diary's
date navigation. It is not a sixth bottom tab: a tab is visited when someone
remembers to, and a check-in that is not filled daily makes the whole feature
worthless.

Shape — one card that fills up over the day:

```
Nacht auf Di., 18.8.
  Schlaf    – h –          [7:15]   Qualität ①②③④⑤

Dein Tag
  Wie ging es dir heute?   ①②③④⑤⑥⑦⑧⑨⑩
  ▸ Genauer
      Energie ①②③④⑤   Stimmung ①②③④⑤   Verdauung ①②③④⑤
  Alkohol   – + 0 Gläser
  ▸ Weitere Felder …            → /klient/einstellungen
```

Rules:

- Only tracked metrics render. "Weitere Felder" links to settings rather than
  offering an inline picker; there is one place where this is configured.
- **The wellbeing question is asked above the day's totals**, never next to
  them. Someone who first sees their kcal balance rates the balance.
- Every field saves on change, debounced like the day note. There is no save
  button and no modal.
- Any past date can be filled or corrected, without limit and without marking.
  A late entry is not worth less than a timely one; refusing it just produces
  gaps.
- Nothing is mandatory in the sense of blocking. "Mandatory" for `wellbeing`
  means it is always visible and cannot be switched off, not that a day is
  rejected without it.

## Settings

New section in `/klient/einstellungen`, one row per metric, grouped by
`ClientMetric.group`:

| | tracken | anzeigen | teilen |
|---|---|---|---|
| Wohlbefinden | fixed on | ☑ | ☑ |
| Energie / Stimmung / Verdauung | ☐ | ☑ | ☑ |
| Schlafdauer / Schlafqualität | ☑ / ☐ | ☑ | ☑ |
| Alkohol | ☐ | ☑ | ☑ |
| Ernährung, Training, Gewicht | derived | ☑ | ☑ |

- **tracken** — does the field appear in the check-in.
- **anzeigen** — does the metric appear in the Verlauf and in the pair picker.
- **teilen** — may the counselor see it. Greyed out with an explanation when no
  active link exists or `consent_wellbeing` is off; the per-metric switch can
  only ever narrow what the consent already permits, never widen it.

Switching `tracked` off hides the field. It never deletes past values — the data
stays, and switching back on reveals a complete history. A separate, explicit
delete belongs to the DSGVO work, not to a preference switch.

## The evaluation

New section "Zusammenhänge" in the Verlauf module (`statistik`), plus the plain
Befinden series above it. Window: **56 days**, with a 14/28/56 selector. The
existing 14-day nutrient charts stay as they are; they answer a different
question.

### 1. Time-axis chart

Two user-picked metrics over the window, one line each, on two Y axes with
independent padded domains (the existing `PADDED_DOMAIN` helper). Dual axes can
make any two series look aligned, so both axes are labelled with unit and range,
and the chart never states a relationship in words.

- `connectNulls={false}`; gaps stay gaps, and days without data get a grey band,
  the same treatment the micronutrient bars already use.
- The day note appears as a marker on days that have one, so an outlier stays
  explainable ("Einladung bei Freunden") instead of looking like noise.
- Horizontal scroll container on phones; 56 daily points do not fit a phone
  width without becoming a smear.

### 2. Shift control

A slider from −3 to +3 days that moves the second series against the first. This
is what makes a delayed relationship legible by eye — a run of bad sleep showing
up in wellbeing two days later is invisible in a same-day comparison and obvious
in a shifted one.

- Label states plainly what is being compared: "Schlaf, 2 Tage vorher →
  Wohlbefinden".
- The bucket table below recomputes for the chosen shift, and the usable day
  count drops by |shift|, which is shown.
- The app never scans shifts for the strongest result, never marks one as best,
  and offers no default other than 0. Searching seven lags across many pairs is
  precisely how spurious findings are manufactured — the user drives, and the
  disclaimer stays.

### 3. Bucket comparison

The readable form, and the one that answers the original question:

```
Schlaf  →  Wohlbefinden          56 Tage · 28 mit beiden Werten

  < 6 h    ▓▓▓▓▓░░░░░   5,1   n=4
  6–7 h    ▓▓▓▓▓▓░░░░   6,4   n=7
  7–8 h    ▓▓▓▓▓▓▓░░░   7,2   n=9
  > 8 h    ░░░░░░░░░░    –    n=2 · zu wenige Tage

  Zusammenhang, keine Ursache.
```

- The section appears only from **14 days with both values**; below that it
  states how many are missing, and shows nothing else.
- A bucket with **n < 3** is drawn grey, without a value, and is never dropped —
  a hidden bucket is a lie about the data.
- Quartile buckets are labelled with their real range ("1 750–2 050 kcal"), not
  "Q2".
- No colour coding by "good" or "bad" direction. The bars are one colour.

The last picked pair is remembered in `localStorage`. No schema.

## Counselor side (M8.4)

A Befinden section in `components/patient-tabs/klienten-app-tab.tsx`: the shared
metrics as a series over the same window, plus the day notes already visible
there. Read strictly through `client_wellbeing_series()`.

This is where interpretation is allowed to happen, by a professional, in a
conversation — which is the reason the app itself does none.

## Rejected alternatives

- **Wellbeing as its own bottom tab.** Better information architecture, worse
  fill rate, and fill rate is the entire feature.
- **No settings screen, "what you fill is what you track".** Cheaper and
  self-explanatory, but it cannot express "track it but do not share it", which
  is the switch that makes mood data acceptable to enter at all.
- **Per-metric sharing via RLS policies.** Not expressible; policies are
  row-level. Hence the `SECURITY DEFINER` function.
- **Automatic correlation discovery.** With ~18 metrics there are >150 pairs and
  seven shifts each. At n=28 something always looks strong. It would also be an
  automatic recommendation, which the positioning forbids.
- **A single `client_day_metrics(date, key, value)` EAV table.** Tempting for a
  generic evaluation, but it throws away CHECK constraints and types for a
  flexibility the registry provides anyway.
- **Deriving alcohol from the diary.** No ethanol data in `foods`.
- **Marking backfilled entries as less reliable.** Discourages exactly the
  behaviour the dataset needs.

## Milestones

**M8.1 — Erfassung.** ✅ Shipped. Migrations `…093` and `…094`, registry, assembler,
check-in card in the diary, settings section. **No evaluation.** The evaluation
needs weeks of history that does not exist yet; shipping it on day one means
showing four data points in the one moment it has to convince.

**M8.2 — Befinden im Verlauf.** ✅ Shipped. Wellbeing, sleep and alcohol as plain series
with day-note markers. Window selector.

**M8.3 — Zusammenhänge.** ✅ Shipped. Pair picker, dual-axis chart, shift control, bucket
table, the coverage and n rules.

**M8.4 — Beraterseite.** ✅ Shipped. Migration `…095` with `client_wellbeing_series()`,
consent UI for `consent_wellbeing`, section in the Klienten-App patient tab.

## Risks

- **RLS and the sharing function.** Two accounts, a revoked link and an unshared
  metric each need a Playwright assertion. A wrong predicate here exposes mood
  data across accounts.
- **Fill rate decides everything.** Every added field lowers it. The default set
  is two fields for a reason.
- **DSGVO.** Mood and sleep are health data with a separate consent basis;
  consent, revocation, export and deletion have to actually work.
- **Statistical honesty is a product feature here.** The n rules, the grey
  buckets and the missing disclaimer are not polish — without them the feature
  produces confident nonsense, and the positioning as an evaluation tool is what
  keeps it out of advice territory.
