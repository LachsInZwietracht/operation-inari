"use client"

import { useMemo, useState } from "react"
import {
  ArrowRight,
  Check,
  CopyPlus,
  Lock,
  MessageSquareQuote,
  PencilLine,
  Send,
  Sparkles,
  UserRound,
} from "lucide-react"

import { formatNumber } from "@/lib/format"
import { cn } from "@/lib/utils"
import {
  DEMO_DIET_LINES,
  DEMO_ITEM_MAP,
  DEMO_MACRO_TARGETS,
  DEMO_PATIENT,
  DEMO_SLOT_LABELS,
  DEMO_SLOT_ORDER,
  DEMO_TEMPLATES,
  type DayIndex,
  type DemoTemplate,
} from "./demo-data"
import { DEMO_CHECKIN_SUMMARY } from "./demo-extras"
import {
  AddEntryButton,
  AdditivePanel,
  CheckInPanel,
  ConflictBanner,
  EmptyMeal,
  EntryRow,
  ExportPanel,
  HistoryPanel,
  ItemPicker,
  MicroPanel,
  PrinciplesPanel,
  ReleaseChecklist,
  SharePanel,
  SlotHeading,
  StandBadge,
  TargetList,
  WeekStrip,
  amountLabel,
} from "./flow-shared"
import { useDemoPlan } from "./use-demo-plan"
import { useDemoRelease } from "./use-demo-release"
import {
  Chip,
  EASE,
  InsetPanel,
  PrimaryButton,
  ProgressRing,
  SecondaryButton,
  SectionTitle,
  StudioCard,
  SYSTEM_FONT,
  TONE,
  formatValue,
} from "./studio-ui"

/**
 * Konzept 2 — "Verlauf".
 *
 * The flow follows the case, not a form. A counselor does not build one plan;
 * they carry a client through a sequence of stands — intake, a released plan,
 * what came back from it, the next plan. The rail on the left *is* that
 * sequence, so the current piece of work always sits in the story that produced
 * it, and the released stands stay visible and read-only where they belong.
 *
 * The consequence for the layout: there is no "next" button and no order to
 * obey. Every station is one click away, and the work — targets, meals, checks,
 * release — happens inside the newest stand.
 *
 * Prototype for a design decision. Demo data only, nothing is persisted.
 */

type StationId =
  | "aufnahme"
  | "stand1"
  | "stand2"
  | "rueckmeldung"
  | "zielwerte"
  | "rahmen"
  | "plan"
  | "pruefung"
  | "freigabe"

/** The frozen stands, drawn from the template catalogue so they read as plans. */
const FROZEN: Record<"stand1" | "stand2", { template: DemoTemplate; kcal: number; date: string }> = {
  stand1: { template: DEMO_TEMPLATES[3], kcal: 2300, date: "14. Juli 2026" },
  stand2: { template: DEMO_TEMPLATES[0], kcal: 2100, date: "4. August 2026" },
}

export function ConceptVerlauf() {
  const plan = useDemoPlan(3)
  const release = useDemoRelease("revision")
  const [station, setStation] = useState<StationId>("rueckmeldung")
  const [dietLineId, setDietLineId] = useState(DEMO_DIET_LINES[0].id)
  const [visited, setVisited] = useState<StationId[]>(["rueckmeldung"])

  const go = (next: StationId) => {
    setStation(next)
    setVisited((current) => (current.includes(next) ? current : [...current, next]))
  }

  const kcalReading = plan.macroReadings[0]
  const conflicts = plan.conflicts
  const emptySlots = DEMO_SLOT_ORDER.filter((slot) => plan.day[slot].length === 0)
  const locked = release.status === "released"

  const checks = useMemo(
    () => [
      {
        ok: kcalReading.status === "ok",
        text:
          kcalReading.status === "ok"
            ? "Tagesenergie im Zielkorridor"
            : `${formatNumber(Math.abs(Math.round(kcalReading.remaining)))} kcal ${
                kcalReading.status === "low" ? "unter" : "über"
              } dem Tagesziel`,
      },
      {
        ok: plan.macroReadings[1].status !== "low",
        text:
          plan.macroReadings[1].status !== "low"
            ? "Eiweißmenge erreicht"
            : `${formatValue(Math.abs(plan.macroReadings[1].remaining), "g")} Eiweiß fehlen`,
      },
      {
        ok: plan.microReadings.every((reading) => reading.status !== "low"),
        text: plan.microReadings.some((reading) => reading.status === "low")
          ? `${plan.microReadings
              .filter((reading) => reading.status === "low")
              .map((reading) => reading.target.label)
              .join(", ")} unter dem Referenzwert`
          : "Alle Mikronährstoffe gedeckt",
      },
      {
        critical: true,
        ok: conflicts.length === 0,
        text:
          conflicts.length === 0
            ? "Keine Allergenkonflikte im Plan"
            : `${conflicts.map((conflict) => conflict.item.name).join(", ")} enthält ein Allergen`,
      },
      {
        ok: emptySlots.length === 0,
        text:
          emptySlots.length === 0
            ? "Alle fünf Mahlzeiten belegt"
            : `${emptySlots.map((slot) => DEMO_SLOT_LABELS[slot]).join(", ")} noch leer`,
      },
      {
        ok: true,
        text: `Antwort auf die Rückmeldung: ${DEMO_CHECKIN_SUMMARY.weakest} adressiert`,
      },
    ],
    [conflicts, emptySlots, kcalReading, plan.macroReadings, plan.microReadings],
  )

  return (
    <div style={{ fontFamily: SYSTEM_FONT }} className="mx-auto w-full max-w-[1180px]">
      {/* One header for the whole case — it never changes with the station. */}
      <div className="flex flex-wrap items-center gap-4 pb-6">
        <span className="flex size-12 flex-none items-center justify-center rounded-full bg-black/[0.05] text-[16px] font-semibold dark:bg-white/[0.08]">
          {DEMO_PATIENT.initials}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[24px] leading-tight font-bold tracking-[-0.018em]">
            {DEMO_PATIENT.name}
          </h2>
          <p className="text-[13px] text-muted-foreground">
            {DEMO_PATIENT.age} Jahre · {DEMO_PATIENT.indication} · in Beratung seit 12. Juli 2026
          </p>
        </div>
        <StandBadge status={release.status} revision={release.revision} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[236px_minmax(0,1fr)]">
        {/* -------------------------------------------------------------- */}
        {/* The case, as a rail. Past stands stay in it; they are the reason */}
        {/* the current one looks the way it does.                          */}
        <nav className="lg:sticky lg:top-28 lg:self-start">
          <ol className="space-y-0">
            <RailItem
              id="aufnahme"
              active={station === "aufnahme"}
              done
              label="Aufnahme"
              meta="12. Juli 2026"
              icon={<UserRound className="size-3" />}
              onClick={go}
            />
            <RailItem
              id="stand1"
              active={station === "stand1"}
              done
              muted
              label="Stand 1"
              meta="freigegeben 14. Juli · ersetzt"
              icon={<Lock className="size-3" />}
              onClick={go}
            />
            <RailItem
              id="stand2"
              active={station === "stand2"}
              done
              label="Stand 2"
              meta="freigegeben 4. August · gültig"
              icon={<Lock className="size-3" />}
              onClick={go}
            />
            <RailItem
              id="rueckmeldung"
              active={station === "rueckmeldung"}
              done
              label="Rückmeldung"
              meta="7 Tage dokumentiert"
              icon={<MessageSquareQuote className="size-3" />}
              onClick={go}
            />

            <li className="pt-4 pb-2 pl-9">
              <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                Stand {release.revision} · {locked ? "freigegeben" : "in Arbeit"}
              </p>
            </li>

            {(
              [
                ["zielwerte", "Zielwerte", "2.100 kcal · Mediterran"],
                ["rahmen", "Rahmen & Prinzipien", `${DEMO_PATIENT.allergens.length} Allergie, 6 Regeln`],
                ["plan", "Tagesplan", `${plan.entryCount} Einträge`],
                ["pruefung", "Prüfung", `${checks.filter((check) => !check.ok).length} offen`],
                ["freigabe", "Freigabe", locked ? "übergeben" : "ausstehend"],
              ] as Array<[StationId, string, string]>
            ).map(([id, label, meta], index, list) => (
              <RailItem
                key={id}
                id={id}
                active={station === id}
                done={visited.includes(id)}
                last={index === list.length - 1}
                label={label}
                meta={meta}
                onClick={go}
              />
            ))}
          </ol>
        </nav>

        {/* -------------------------------------------------------------- */}
        <div className="min-w-0 space-y-4 pb-10">
          {station === "aufnahme" && (
            <StudioCard className="space-y-6 p-6 sm:p-8">
              <div>
                <h3 className="text-[22px] font-bold tracking-[-0.015em]">Aufnahme</h3>
                <p className="mt-1 text-[14px] text-muted-foreground">
                  Was am Anfang festgehalten wurde. Alles Weitere ist eine Antwort darauf.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <Fact label="Ziel" value={DEMO_PATIENT.goal} />
                <Fact
                  label="Gewicht"
                  value={`${formatNumber(DEMO_PATIENT.weight)} kg → ${formatNumber(DEMO_PATIENT.targetWeight)} kg`}
                />
                <Fact label="Indikation" value={DEMO_PATIENT.indication} />
                <Fact
                  label="Gesamtumsatz"
                  value={`${formatNumber(DEMO_PATIENT.energyRequirement)} kcal`}
                />
                <Fact label="Kostform" value={DEMO_PATIENT.dietStyle} />
                <Fact label="Ausschlüsse" value={DEMO_PATIENT.exclusions.join(", ")} />
              </div>

              <InsetPanel
                className="flex items-start gap-3"
                style={{ background: `color-mix(in oklab, var(--urgency-overdue) 8%, transparent)` }}
              >
                <div className="text-[13px]">
                  <p className="font-semibold">Allergien</p>
                  <p className="text-muted-foreground">
                    {DEMO_PATIENT.allergens.join(", ")} – jeder Treffer im Plan wird markiert.
                  </p>
                </div>
              </InsetPanel>

              <p className="border-l-2 border-black/[0.12] pl-3 text-[14px] italic dark:border-white/[0.16]">
                „Ich möchte wieder ohne Puste die Treppe hochkommen und meine Werte in den Griff
                bekommen.“
              </p>
            </StudioCard>
          )}

          {(station === "stand1" || station === "stand2") && (
            <FrozenStand
              id={station}
              onReuse={() => {
                plan.applyTemplate(FROZEN[station].template.id)
                go("plan")
              }}
            />
          )}

          {station === "rueckmeldung" && (
            <>
              <StudioCard className="space-y-6 p-6 sm:p-8">
                <div>
                  <h3 className="text-[22px] font-bold tracking-[-0.015em]">
                    Was seit Stand 2 zurückkam
                  </h3>
                  <p className="mt-1 text-[14px] text-muted-foreground">
                    Sieben Tage Check-in aus der Klienten-App. Der Ausgangspunkt für den nächsten
                    Stand – nicht ein leerer Tagesplan.
                  </p>
                </div>
                <CheckInPanel />
              </StudioCard>

              <StudioCard className="p-6 sm:p-8">
                <SectionTitle>Was das für den nächsten Stand heißt</SectionTitle>
                <div className="space-y-3">
                  <Insight
                    text="Der Nachmittag trägt aktuell nur 4 % der Tagesenergie – der Heißhunger am Abend hat dort seine Ursache."
                    action="Nachmittagssnack stärken"
                    onClick={() => go("plan")}
                  />
                  <Insight
                    text="Verdauung ist der schwächste Wert der Woche. Die Ballaststoffe liegen im letzten Stand bei 24 g."
                    action="Ballaststoffe prüfen"
                    onClick={() => go("pruefung")}
                  />
                  <Insight
                    text="0,8 kg in sieben Tagen – das Defizit von 250 kcal wirkt, es muss nicht nachgeschärft werden."
                    action="Zielwerte ansehen"
                    onClick={() => go("zielwerte")}
                  />
                </div>

                <div className="mt-6 border-t border-black/[0.07] pt-5 dark:border-white/[0.09]">
                  <PrimaryButton icon={<PencilLine className="size-4" />} onClick={() => go("plan")}>
                    Stand {release.revision} bearbeiten
                  </PrimaryButton>
                </div>
              </StudioCard>
            </>
          )}

          {station === "zielwerte" && (
            <>
              <StudioCard className="space-y-6 p-6 sm:p-8">
                <div>
                  <h3 className="text-[22px] font-bold tracking-[-0.015em]">Zielwerte</h3>
                  <p className="mt-1 text-[14px] text-muted-foreground">
                    Sie hängen an der Klientin, nicht am Tag – deshalb gelten sie auch für jeden
                    weiteren Stand.
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-4">
                  {DEMO_MACRO_TARGETS.slice(0, 4).map((target) => (
                    <div
                      key={target.key}
                      className="rounded-[14px] border border-black/[0.06] p-3.5 dark:border-white/[0.08]"
                    >
                      <p className="text-[12px] text-muted-foreground">{target.label}</p>
                      <p className="mt-1 text-[20px] font-semibold tabular-nums">
                        {formatNumber(target.goal)}
                        <span className="ml-1 text-[13px] font-normal text-muted-foreground">
                          {target.unit}
                        </span>
                      </p>
                    </div>
                  ))}
                </div>

                <InsetPanel>
                  <p className="text-[13px] text-muted-foreground">
                    Gesamtumsatz {formatNumber(DEMO_PATIENT.energyRequirement)} kcal ·{" "}
                    <span className="font-medium text-foreground">
                      Defizit {formatNumber(DEMO_PATIENT.energyRequirement - 2100)} kcal ≈{" "}
                      {formatNumber((DEMO_PATIENT.energyRequirement - 2100) / 1000, 2)} kg pro Woche
                    </span>{" "}
                    · Ziel {formatNumber(DEMO_PATIENT.weight - DEMO_PATIENT.targetWeight)} kg in rund{" "}
                    {Math.round(
                      (DEMO_PATIENT.weight - DEMO_PATIENT.targetWeight) /
                        ((DEMO_PATIENT.energyRequirement - 2100) / 1000),
                    )}{" "}
                    Wochen
                  </p>
                </InsetPanel>

                <div>
                  <SectionTitle>Zielprofil</SectionTitle>
                  <div className="flex flex-wrap gap-2">
                    {DEMO_DIET_LINES.map((line) => (
                      <Chip
                        key={line.id}
                        active={dietLineId === line.id}
                        onClick={() => setDietLineId(line.id)}
                      >
                        {line.name}
                      </Chip>
                    ))}
                  </div>
                </div>
              </StudioCard>

              <StudioCard className="p-6 sm:p-8">
                <SectionTitle>Gemessen am offenen Tag</SectionTitle>
                <TargetList readings={plan.macroReadings} />
              </StudioCard>
            </>
          )}

          {station === "rahmen" && (
            <>
              <StudioCard className="space-y-5 p-6 sm:p-8">
                <div>
                  <h3 className="text-[22px] font-bold tracking-[-0.015em]">Rahmen</h3>
                  <p className="mt-1 text-[14px] text-muted-foreground">
                    Kostform, Ausschlüsse und Allergien filtern jede Auswahl in der Bibliothek.
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <Fact label="Kostform" value={DEMO_PATIENT.dietStyle} />
                  <Fact label="Ausschlüsse" value={DEMO_PATIENT.exclusions.join(", ")} />
                  <Fact label="Allergien" value={DEMO_PATIENT.allergens.join(", ")} alert />
                </div>
              </StudioCard>

              <StudioCard className="p-6 sm:p-8">
                <SectionTitle>Prinzipien</SectionTitle>
                <p className="mb-4 -mt-1 text-[13px] text-muted-foreground">
                  Die Regeln, die die Klientin auch ohne Plan anwenden kann. Jede ist auf die Zahl
                  zurückführbar, aus der sie stammt.
                </p>
                <PrinciplesPanel />
              </StudioCard>
            </>
          )}

          {station === "plan" && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-[22px] font-bold tracking-[-0.015em]">Tagesplan</h3>
                  <p className="text-[14px] text-muted-foreground">
                    {formatNumber(Math.round(plan.totals.kcal))} von{" "}
                    {formatNumber(kcalReading.goal)} kcal · {plan.entryCount} Einträge
                  </p>
                </div>
                <SecondaryButton
                  icon={<CopyPlus className="size-4" />}
                  onClick={() => plan.duplicateDay(plan.activeDay, ((plan.activeDay + 1) % 7) as DayIndex)}
                >
                  Auf den Folgetag kopieren
                </SecondaryButton>
              </div>

              <StudioCard className="p-4">
                <WeekStrip
                  weekKcal={plan.weekKcal}
                  active={plan.activeDay}
                  target={kcalReading.goal}
                  onSelect={plan.setActiveDay}
                  onCopy={plan.duplicateDay}
                />
              </StudioCard>

              <ConflictBanner conflicts={conflicts} />

              <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
                <div className="space-y-3">
                  {DEMO_SLOT_ORDER.map((slot) => (
                    <StudioCard key={slot} className="overflow-hidden">
                      <SlotHeading
                        slot={slot}
                        kcal={plan.slotTotals.get(slot)?.kcal ?? 0}
                        count={plan.day[slot].length}
                      />
                      <div className="h-px bg-black/[0.06] dark:bg-white/[0.08]" />
                      {plan.day[slot].length === 0 ? (
                        <EmptyMeal>Noch nichts geplant.</EmptyMeal>
                      ) : (
                        plan.day[slot].map((entry, index) => (
                          <div key={entry.id}>
                            {index > 0 && (
                              <div className="ml-4 h-px bg-black/[0.06] dark:bg-white/[0.08]" />
                            )}
                            <EntryRow
                              entry={entry}
                              slot={slot}
                              onAmount={(amount) => plan.setAmount(slot, entry.id, amount)}
                              onRemove={() => plan.removeEntry(slot, entry.id)}
                              onMove={(target) => plan.moveEntry(slot, target, entry.id)}
                              onExchange={(itemId, amount) => {
                                plan.removeEntry(slot, entry.id)
                                plan.addItem(slot, itemId, amount)
                              }}
                            />
                          </div>
                        ))
                      )}
                      <div className="border-t border-black/[0.06] px-2 py-1.5 dark:border-white/[0.08]">
                        <AddEntryButton
                          day={plan.day}
                          label={`Zu ${DEMO_SLOT_LABELS[slot]} hinzufügen`}
                          onPick={(itemId, amount) => plan.addItem(slot, itemId, amount)}
                        />
                      </div>
                    </StudioCard>
                  ))}
                </div>

                <StudioCard className="overflow-hidden xl:sticky xl:top-28 xl:self-start">
                  <div className="px-4 pt-4">
                    <SectionTitle>Bibliothek</SectionTitle>
                  </div>
                  <ItemPicker
                    day={plan.day}
                    className="-mt-2 h-[520px]"
                    onPick={(itemId, amount, slot) =>
                      plan.addItem(slot ?? "snack_nachmittag", itemId, amount)
                    }
                    onPickTemplate={(templateId) => plan.applyTemplate(templateId)}
                    onImport={() => undefined}
                  />
                </StudioCard>
              </div>
            </>
          )}

          {station === "pruefung" && (
            <>
              <StudioCard className="p-6 sm:p-8">
                <div className="flex flex-wrap items-center gap-8">
                  <ProgressRing
                    ratio={kcalReading.ratio}
                    size={140}
                    stroke={13}
                    status={kcalReading.status}
                  >
                    <span className="text-[30px] leading-none font-bold tracking-[-0.02em] tabular-nums">
                      {formatNumber(Math.round(kcalReading.value))}
                    </span>
                    <span className="mt-1 text-[12px] text-muted-foreground">
                      von {formatNumber(kcalReading.goal)} kcal
                    </span>
                  </ProgressRing>
                  <TargetList
                    readings={plan.macroReadings.slice(1)}
                    className="min-w-[240px] flex-1"
                  />
                </div>
              </StudioCard>

              <ConflictBanner conflicts={conflicts} />

              <div className="grid gap-4 lg:grid-cols-2">
                <StudioCard className="p-5 sm:p-6">
                  <SectionTitle>Mikronährstoffe</SectionTitle>
                  <MicroPanel
                    readings={plan.microReadings}
                    onAdd={(itemId, amount) => plan.addItem("snack_nachmittag", itemId, amount)}
                  />
                </StudioCard>
                <div className="space-y-4">
                  <StudioCard className="p-5 sm:p-6">
                    <SectionTitle>Verteilung über den Tag</SectionTitle>
                    <SharePanel day={plan.day} />
                  </StudioCard>
                  <StudioCard className="p-5 sm:p-6">
                    <SectionTitle>Zusatzstoffe</SectionTitle>
                    <AdditivePanel codes={plan.additives} />
                  </StudioCard>
                </div>
              </div>

              <StudioCard className="p-6 sm:p-8">
                <SectionTitle>Offene Punkte</SectionTitle>
                <ReleaseChecklist checks={checks} />
                <div className="mt-5">
                  <PrimaryButton icon={<ArrowRight className="size-4" />} onClick={() => go("freigabe")}>
                    Weiter zur Freigabe
                  </PrimaryButton>
                </div>
              </StudioCard>
            </>
          )}

          {station === "freigabe" && (
            <>
              <StudioCard className="p-6 sm:p-8">
                <h3 className="text-[22px] font-bold tracking-[-0.015em]">
                  {locked ? `Stand ${release.revision} ist übergeben` : `Stand ${release.revision} freigeben`}
                </h3>
                <p className="mt-1 mb-5 text-[14px] text-muted-foreground">
                  {locked
                    ? "Der Stand ist unveränderlich und für die Klientin sichtbar. Eine Änderung öffnet den nächsten Entwurf."
                    : `Mit der Freigabe wird dieser Stand unveränderlich und für die Klientin sichtbar. Bis dahin bleibt Stand ${release.revision - 1} gültig.`}
                </p>

                <ReleaseChecklist checks={checks} />

                <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-black/[0.07] pt-6 dark:border-white/[0.09]">
                  {locked ? (
                    <>
                      <span
                        className="flex items-center gap-2 text-[15px] font-semibold"
                        style={{ color: TONE.ok.fill }}
                      >
                        <Check className="size-4" />
                        Freigegeben
                      </span>
                      <PrimaryButton
                        icon={<PencilLine className="size-4" />}
                        onClick={release.beginRevision}
                        className="ml-auto"
                      >
                        Änderung beginnen
                      </PrimaryButton>
                    </>
                  ) : (
                    <PrimaryButton
                      icon={<Send className="size-4" />}
                      disabled={plan.entryCount === 0}
                      onClick={release.release}
                    >
                      Verbindlich freigeben
                    </PrimaryButton>
                  )}
                </div>
              </StudioCard>

              <div className="grid gap-4 lg:grid-cols-2">
                <StudioCard className="p-5 sm:p-6">
                  <SectionTitle>Stände</SectionTitle>
                  <HistoryPanel
                    history={release.history}
                    currentRevision={release.revision}
                    status={release.status}
                  />
                </StudioCard>
                <StudioCard className="p-5 sm:p-6">
                  <SectionTitle>Übergabe</SectionTitle>
                  <ExportPanel week={plan.week} />
                </StudioCard>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */

function RailItem({
  id,
  label,
  meta,
  active,
  done,
  muted,
  last,
  icon,
  onClick,
}: {
  id: StationId
  label: string
  meta: string
  active: boolean
  done?: boolean
  muted?: boolean
  last?: boolean
  icon?: React.ReactNode
  onClick: (id: StationId) => void
}) {
  return (
    <li className="flex gap-3">
      <span className="flex flex-none flex-col items-center">
        <span
          style={{ transitionTimingFunction: EASE }}
          className={cn(
            "mt-1 flex size-6 items-center justify-center rounded-full text-[11px] font-semibold transition-all duration-300",
            active
              ? "bg-foreground text-background"
              : done
                ? "bg-[color-mix(in_oklab,var(--primary)_16%,transparent)] text-[var(--primary)]"
                : "border border-dashed border-black/[0.2] text-muted-foreground dark:border-white/[0.25]",
            muted && !active && "bg-black/[0.06] text-muted-foreground dark:bg-white/[0.08]",
          )}
        >
          {icon ?? (done ? <Check className="size-3" /> : null)}
        </span>
        {!last && <span className="w-px flex-1 bg-black/[0.09] dark:bg-white/[0.12]" />}
      </span>

      <button
        type="button"
        onClick={() => onClick(id)}
        className="min-w-0 flex-1 pb-4 text-left"
      >
        <span
          className={cn(
            "block truncate text-[14px] font-medium transition-colors",
            active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
            muted && !active && "opacity-70",
          )}
        >
          {label}
        </span>
        <span className="block truncate text-[12px] text-muted-foreground">{meta}</span>
      </button>
    </li>
  )
}

function Fact({ label, value, alert }: { label: string; value: string; alert?: boolean }) {
  return (
    <div className="rounded-[14px] border border-black/[0.06] p-3.5 dark:border-white/[0.08]">
      <p className="text-[12px] text-muted-foreground">{label}</p>
      <p
        className="mt-0.5 text-[15px] font-medium"
        style={alert ? { color: "var(--urgency-overdue)" } : undefined}
      >
        {value}
      </p>
    </div>
  )
}

function Insight({
  text,
  action,
  onClick,
}: {
  text: string
  action: string
  onClick: () => void
}) {
  return (
    <div className="flex flex-wrap items-start gap-3 rounded-[16px] border border-black/[0.06] p-4 dark:border-white/[0.08]">
      <Sparkles className="mt-0.5 size-4 flex-none text-[var(--primary)]" />
      <p className="min-w-[200px] flex-1 text-[14px]">{text}</p>
      <button
        type="button"
        onClick={onClick}
        className="flex items-center gap-1 rounded-full px-3 py-1.5 text-[13px] font-medium text-[var(--primary)] transition-colors hover:bg-[color-mix(in_oklab,var(--primary)_10%,transparent)]"
      >
        {action}
        <ArrowRight className="size-3.5" />
      </button>
    </div>
  )
}

/**
 * A released stand, exactly as it was handed over.
 *
 * Read-only on purpose: the release workflow's whole point is that a stand is
 * never edited after the fact. The one action offered is the one that is
 * allowed — take it as the starting point for the next one.
 */
function FrozenStand({ id, onReuse }: { id: "stand1" | "stand2"; onReuse: () => void }) {
  const { template, kcal, date } = FROZEN[id]
  const replaced = id === "stand1"

  return (
    <StudioCard className="overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 border-b border-black/[0.06] px-6 py-5 dark:border-white/[0.08]">
        <Lock className="size-4 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <h3 className="text-[18px] font-semibold tracking-[-0.01em]">
            {id === "stand1" ? "Stand 1" : "Stand 2"} · {template.name}
          </h3>
          <p className="text-[13px] text-muted-foreground">
            freigegeben {date} · {formatNumber(kcal)} kcal ·{" "}
            {replaced ? "ersetzt am 4. August 2026" : "aktuell gültig"}
          </p>
        </div>
        <SecondaryButton icon={<CopyPlus className="size-4" />} onClick={onReuse}>
          Als Ausgangspunkt nehmen
        </SecondaryButton>
      </div>

      <div className="divide-y divide-black/[0.06] dark:divide-white/[0.08]">
        {DEMO_SLOT_ORDER.map((slot) => {
          const entries = template.slots.find((entry) => entry.type === slot)?.entries ?? []
          return (
            <div key={slot} className="px-6 py-3">
              <p className="text-[13px] font-semibold">{DEMO_SLOT_LABELS[slot]}</p>
              {entries.length === 0 ? (
                <p className="text-[13px] text-muted-foreground">–</p>
              ) : (
                <ul className="mt-1 space-y-0.5">
                  {entries.map((entry) => {
                    const item = DEMO_ITEM_MAP.get(entry.itemId)
                    if (!item) return null
                    return (
                      <li
                        key={entry.itemId}
                        className="flex items-baseline justify-between gap-3 text-[14px]"
                      >
                        <span className="truncate">{item.name}</span>
                        <span className="flex-none text-[13px] text-muted-foreground tabular-nums">
                          {amountLabel(item, entry.amount)}
                        </span>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          )
        })}
      </div>

      <p className="bg-black/[0.02] px-6 py-3 text-[12px] text-muted-foreground dark:bg-white/[0.03]">
        Freigegebene Stände sind unveränderlich. Änderungen entstehen als neuer Stand, damit die
        Klientin nie einen Plan in der Hand hält, den es so nicht mehr gibt.
      </p>
    </StudioCard>
  )
}
