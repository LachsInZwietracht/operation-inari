"use client"

import { useMemo, useState } from "react"
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Eye,
  Library,
  Lock,
  PencilLine,
  PieChart,
  Plus,
  Send,
  Send as SendIcon,
  Settings2,
  TriangleAlert,
} from "lucide-react"

import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
} from "@/components/ui/drawer"
import { formatNumber } from "@/lib/format"
import { cn } from "@/lib/utils"
import {
  DEMO_ITEM_MAP,
  DEMO_PATIENT,
  DEMO_SLOT_LABELS,
  DEMO_SLOT_ORDER,
  DEMO_SLOT_TIME,
  WEEKDAY_LONG,
  type DayIndex,
  type DemoSlotType,
} from "./demo-data"
import {
  AdditivePanel,
  CheckInPanel,
  ConflictBanner,
  EntryEditor,
  ExportPanel,
  HistoryPanel,
  ItemPicker,
  MicroPanel,
  PrinciplesPanel,
  ReleaseChecklist,
  SharePanel,
  StandBadge,
  TargetList,
  WeekStrip,
  amountLabel,
  hasConflict,
} from "./flow-shared"
import { useDemoPlan, useDemoWeekDates } from "./use-demo-plan"
import { useDemoRelease } from "./use-demo-release"
import {
  ALERT,
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

/**
 * Konzept 3 — "Tagesbogen".
 *
 * The flow follows the client's day rather than the app's data model: five
 * meals along the clock, from 7:30 to 19:00, and nothing else on screen. Every
 * other function — library, balance, frame, week, release — comes up from the
 * bottom as a sheet and goes away again.
 *
 * It is built for the half of the counselor's work that happens with the client
 * sitting next to them: large type, one thing at a time, and a "Klientensicht"
 * that drops every number the client should not have to read.
 *
 * Prototype for a design decision. Demo data only, nothing is persisted.
 */

type SheetId = "bibliothek" | "bilanz" | "rahmen" | "woche" | "freigabe"

const SHEETS: Array<{ id: SheetId; label: string; icon: typeof Library }> = [
  { id: "bibliothek", label: "Bibliothek", icon: Library },
  { id: "bilanz", label: "Bilanz", icon: PieChart },
  { id: "rahmen", label: "Rahmen", icon: Settings2 },
  { id: "woche", label: "Woche", icon: Calendar },
  { id: "freigabe", label: "Freigabe", icon: SendIcon },
]

export function ConceptTagesbogen() {
  const plan = useDemoPlan(3)
  const release = useDemoRelease("revision")
  const dates = useDemoWeekDates()
  const [sheet, setSheet] = useState<SheetId | null>(null)
  const [targetSlot, setTargetSlot] = useState<DemoSlotType>("snack_nachmittag")
  /** Hides every number the client should not have to read. */
  const [presenting, setPresenting] = useState(false)

  const kcalReading = plan.macroReadings[0]
  const locked = release.status === "released"
  const emptySlots = DEMO_SLOT_ORDER.filter((slot) => plan.day[slot].length === 0)
  const date = dates[plan.activeDay]

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
        ok: plan.macroReadings[4].status !== "low",
        text:
          plan.macroReadings[4].status !== "low"
            ? "Ballaststoffe erreicht"
            : `${formatValue(Math.abs(plan.macroReadings[4].remaining), "g")} Ballaststoffe fehlen`,
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
        ok: plan.conflicts.length === 0,
        text:
          plan.conflicts.length === 0
            ? "Keine Allergenkonflikte im Plan"
            : `${plan.conflicts.map((conflict) => conflict.item.name).join(", ")} enthält ein Allergen`,
      },
      {
        ok: emptySlots.length === 0,
        text:
          emptySlots.length === 0
            ? "Alle fünf Mahlzeiten belegt"
            : `${emptySlots.map((slot) => DEMO_SLOT_LABELS[slot]).join(", ")} noch leer`,
      },
    ],
    [emptySlots, kcalReading, plan.conflicts, plan.macroReadings, plan.microReadings],
  )

  const openSheet = (id: SheetId, slot?: DemoSlotType) => {
    if (slot) setTargetSlot(slot)
    setSheet(id)
  }

  return (
    <div style={{ fontFamily: SYSTEM_FONT }} className="mx-auto w-full max-w-[680px] pb-32">
      {/* ---------------------------------------------------------------- */}
      {/* One status line for the whole day. It is the only place numbers   */}
      {/* live while the plan is being built.                               */}
      <div className="bg-background/85 sticky top-0 z-30 -mx-2 px-2 py-2 backdrop-blur-xl">
        <StudioCard className="flex items-center gap-4 px-4 py-3">
          <button
            type="button"
            aria-label="Vorheriger Tag"
            onClick={() => plan.setActiveDay(((plan.activeDay + 6) % 7) as DayIndex)}
            className="flex size-8 flex-none items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-black/[0.05] dark:hover:bg-white/[0.07]"
          >
            <ChevronLeft className="size-4" />
          </button>

          <div className="min-w-0 flex-1">
            <p className="truncate text-[16px] font-semibold tracking-[-0.01em]">
              {WEEKDAY_LONG[plan.activeDay]}
              {date ? `, ${date.getDate()}. ${date.toLocaleDateString("de-DE", { month: "long" })}` : ""}
            </p>
            <p className="truncate text-[12px] text-muted-foreground">
              {DEMO_PATIENT.name}
              {presenting ? "" : ` · ${plan.entryCount} Einträge`}
            </p>
          </div>

          <button
            type="button"
            aria-label="Nächster Tag"
            onClick={() => plan.setActiveDay(((plan.activeDay + 1) % 7) as DayIndex)}
            className="flex size-8 flex-none items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-black/[0.05] dark:hover:bg-white/[0.07]"
          >
            <ChevronRight className="size-4" />
          </button>

          {!presenting && (
            <button
              type="button"
              onClick={() => openSheet("bilanz")}
              className="flex flex-none items-center gap-2.5 rounded-full py-1 pr-1 pl-2 transition-colors hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
            >
              <span className="text-right">
                <span className="block text-[15px] leading-tight font-semibold tabular-nums">
                  {formatNumber(Math.round(plan.totals.kcal))}
                </span>
                <span className="block text-[11px] leading-tight text-muted-foreground tabular-nums">
                  von {formatNumber(kcalReading.goal)}
                </span>
              </span>
              <ProgressRing
                ratio={kcalReading.ratio}
                size={36}
                stroke={4}
                status={kcalReading.status}
              />
            </button>
          )}
        </StudioCard>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <StandBadge status={release.status} revision={release.revision} />
        <button
          type="button"
          onClick={() => setPresenting((value) => !value)}
          style={{ transitionTimingFunction: EASE }}
          className={cn(
            "flex items-center gap-2 rounded-full border px-3 py-1.5 text-[13px] font-medium transition-all duration-300",
            presenting
              ? "border-[var(--primary)] bg-[color-mix(in_oklab,var(--primary)_10%,transparent)] text-[var(--primary)]"
              : "border-black/[0.08] text-muted-foreground hover:bg-black/[0.04] dark:border-white/[0.1] dark:hover:bg-white/[0.06]",
          )}
        >
          <Eye className="size-3.5" />
          Klientensicht
        </button>
        {presenting && (
          <span className="text-[12px] text-muted-foreground">
            Nährwerte ausgeblendet – so sieht Anna Berger den Plan.
          </span>
        )}
      </div>

      {!presenting && <ConflictBanner conflicts={plan.conflicts} className="mt-4" />}

      {/* ---------------------------------------------------------------- */}
      {/* The day along the clock.                                          */}
      <div className="mt-5">
        {DEMO_SLOT_ORDER.map((slot, index) => {
          const entries = plan.day[slot]
          const kcal = plan.slotTotals.get(slot)?.kcal ?? 0
          return (
            <div key={slot} className="flex gap-3">
              {/* The clock rail: a time, a dot, and the line to the next meal. */}
              <div className="flex w-[52px] flex-none flex-col items-end">
                <span className="text-[13px] font-medium text-muted-foreground tabular-nums">
                  {DEMO_SLOT_TIME[slot]}
                </span>
                <span className="flex flex-1 flex-col items-center pt-1.5 pr-[3px]">
                  <span
                    className="size-2 rounded-full"
                    style={{
                      background: entries.length > 0 ? TONE.ok.fill : "var(--color-track)",
                    }}
                  />
                  {index < DEMO_SLOT_ORDER.length - 1 && (
                    <span className="w-px flex-1 bg-black/[0.08] dark:bg-white/[0.1]" />
                  )}
                </span>
              </div>

              <div className="min-w-0 flex-1 pb-4">
                <StudioCard className="overflow-hidden">
                  <div className="flex items-baseline gap-3 px-4 pt-3.5 pb-2">
                    <span className="text-[17px] font-semibold tracking-[-0.01em]">
                      {DEMO_SLOT_LABELS[slot]}
                    </span>
                    {!presenting && (
                      <span className="ml-auto text-[13px] text-muted-foreground tabular-nums">
                        {entries.length === 0 ? "leer" : `${formatNumber(Math.round(kcal))} kcal`}
                      </span>
                    )}
                  </div>

                  {entries.length === 0 ? (
                    <p className="px-4 pb-2 text-[14px] text-muted-foreground">
                      Noch nichts geplant.
                    </p>
                  ) : (
                    <div>
                      {entries.map((entry, entryIndex) => {
                        const item = DEMO_ITEM_MAP.get(entry.itemId)
                        if (!item) return null
                        const conflict = hasConflict(item)
                        const row = (
                          <div className="flex w-full items-center gap-3 px-4 py-2.5 text-left">
                            <span className="min-w-0 flex-1">
                              <span className="flex items-center gap-1.5">
                                <span className="truncate text-[17px] leading-snug">
                                  {item.name}
                                </span>
                                {conflict && (
                                  <TriangleAlert
                                    className="size-3.5 flex-none"
                                    style={{ color: ALERT }}
                                  />
                                )}
                              </span>
                              <span className="block text-[13px] text-muted-foreground">
                                {amountLabel(item, entry.amount)}
                                {presenting ? "" : ` · ${item.category}`}
                              </span>
                            </span>
                            {!presenting && (
                              <span className="text-[14px] text-muted-foreground tabular-nums">
                                {formatNumber(
                                  Math.round((item.nutrients.kcal * entry.amount) / item.base),
                                )}{" "}
                                kcal
                              </span>
                            )}
                          </div>
                        )

                        return (
                          <div key={entry.id}>
                            {entryIndex > 0 && (
                              <div className="ml-4 h-px bg-black/[0.06] dark:bg-white/[0.08]" />
                            )}
                            {presenting ? (
                              row
                            ) : (
                              <Popover>
                                <PopoverTrigger asChild>
                                  <button
                                    type="button"
                                    className="w-full transition-colors hover:bg-black/[0.025] dark:hover:bg-white/[0.04]"
                                  >
                                    {row}
                                  </button>
                                </PopoverTrigger>
                                <PopoverContent
                                  align="end"
                                  style={{ width: "auto" }}
                                  className="rounded-[18px] border-black/[0.07] p-0 shadow-[0_12px_40px_rgba(0,0,0,0.16)] dark:border-white/[0.1]"
                                >
                                  <EntryEditor
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
                                </PopoverContent>
                              </Popover>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {!presenting && (
                    <button
                      type="button"
                      onClick={() => openSheet("bibliothek", slot)}
                      className="flex w-full items-center gap-2 border-t border-black/[0.06] px-4 py-2.5 text-left text-[14px] font-medium text-[var(--primary)] transition-colors hover:bg-black/[0.03] dark:border-white/[0.08] dark:hover:bg-white/[0.05]"
                    >
                      <Plus className="size-4" />
                      Hinzufügen
                    </button>
                  )}
                </StudioCard>
              </div>
            </div>
          )
        })}
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* Everything that is not the day lives in the dock.                  */}
      <div className="sticky bottom-4 z-30 mt-2 flex justify-center">
        <div className="flex items-center gap-1 rounded-full border border-black/[0.07] bg-background/80 p-1.5 shadow-[0_8px_30px_rgba(0,0,0,0.14)] backdrop-blur-xl dark:border-white/[0.1] dark:bg-background/70">
          {SHEETS.map((entry) => (
            <button
              key={entry.id}
              type="button"
              onClick={() => openSheet(entry.id)}
              style={{ transitionTimingFunction: EASE }}
              className="flex flex-col items-center gap-0.5 rounded-full px-3.5 py-1.5 text-[11px] font-medium text-muted-foreground transition-all duration-200 hover:bg-black/[0.05] hover:text-foreground active:scale-[0.95] dark:hover:bg-white/[0.08] sm:flex-row sm:gap-1.5 sm:text-[13px]"
            >
              <entry.icon className="size-4" />
              {entry.label}
            </button>
          ))}
        </div>
      </div>

      {/* ---------------------------------------------------------------- */}
      <Drawer open={sheet !== null} onOpenChange={(open) => !open && setSheet(null)}>
        <DrawerContent
          style={{ fontFamily: SYSTEM_FONT }}
          className="mx-auto max-h-[86vh] max-w-[720px] rounded-t-[26px]"
        >
          <DrawerTitle className="px-5 pt-3 pb-1 text-[13px] font-semibold tracking-wide text-muted-foreground uppercase">
            {SHEETS.find((entry) => entry.id === sheet)?.label ?? "Werkzeug"}
          </DrawerTitle>
          <DrawerDescription className="sr-only">
            Werkzeuge des Ernährungsplans für {DEMO_PATIENT.name}.
          </DrawerDescription>

          {sheet === "bibliothek" && (
            <div className="flex min-h-0 flex-1 flex-col pt-2 pb-4">
              <div className="px-4 pb-2">
                <p className="text-[17px] font-semibold">Hinzufügen zu</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {DEMO_SLOT_ORDER.map((slot) => (
                    <button
                      key={slot}
                      type="button"
                      onClick={() => setTargetSlot(slot)}
                      className={cn(
                        "rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors",
                        targetSlot === slot
                          ? "bg-foreground text-background"
                          : "bg-black/[0.05] text-muted-foreground hover:bg-black/[0.09] dark:bg-white/[0.07] dark:hover:bg-white/[0.12]",
                      )}
                    >
                      {DEMO_SLOT_LABELS[slot]}
                    </button>
                  ))}
                </div>
              </div>
              <ItemPicker
                day={plan.day}
                className="min-h-0 flex-1"
                onPick={(itemId, amount, slot) => {
                  plan.addItem(slot ?? targetSlot, itemId, amount)
                  setSheet(null)
                }}
                onPickTemplate={(templateId) => {
                  plan.applyTemplate(templateId)
                  setSheet(null)
                }}
                onImport={() => setSheet(null)}
              />
            </div>
          )}

          {sheet === "bilanz" && (
            <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 pt-2 pb-8">
              <div className="flex flex-wrap items-center gap-6">
                <ProgressRing
                  ratio={kcalReading.ratio}
                  size={128}
                  stroke={12}
                  status={kcalReading.status}
                >
                  <span className="text-[26px] leading-none font-bold tracking-[-0.02em] tabular-nums">
                    {formatNumber(Math.round(kcalReading.value))}
                  </span>
                  <span className="mt-1 text-[11px] text-muted-foreground">
                    von {formatNumber(kcalReading.goal)} kcal
                  </span>
                </ProgressRing>
                <TargetList
                  readings={plan.macroReadings.slice(1)}
                  className="min-w-[220px] flex-1"
                />
              </div>

              <div>
                <SectionTitle>Mikronährstoffe</SectionTitle>
                <MicroPanel
                  readings={plan.microReadings}
                  onAdd={(itemId, amount) => plan.addItem(targetSlot, itemId, amount)}
                />
              </div>

              <div>
                <SectionTitle>Verteilung über den Tag</SectionTitle>
                <SharePanel day={plan.day} />
              </div>

              <div>
                <SectionTitle>Zusatzstoffe</SectionTitle>
                <AdditivePanel codes={plan.additives} />
              </div>
            </div>
          )}

          {sheet === "rahmen" && (
            <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 pt-2 pb-8">
              <div>
                <SectionTitle>Klientin</SectionTitle>
                <div className="grid gap-2.5 sm:grid-cols-2">
                  <InsetPanel>
                    <p className="text-[12px] text-muted-foreground">Ziel</p>
                    <p className="text-[15px] font-medium">
                      {DEMO_PATIENT.goal} · {formatNumber(DEMO_PATIENT.weight)} →{" "}
                      {formatNumber(DEMO_PATIENT.targetWeight)} kg
                    </p>
                  </InsetPanel>
                  <InsetPanel>
                    <p className="text-[12px] text-muted-foreground">Energie</p>
                    <p className="text-[15px] font-medium">
                      {formatNumber(kcalReading.goal)} kcal von{" "}
                      {formatNumber(DEMO_PATIENT.energyRequirement)} kcal Umsatz
                    </p>
                  </InsetPanel>
                  <InsetPanel>
                    <p className="text-[12px] text-muted-foreground">Kostform</p>
                    <p className="text-[15px] font-medium">
                      {DEMO_PATIENT.dietStyle} · ohne {DEMO_PATIENT.exclusions.join(", ")}
                    </p>
                  </InsetPanel>
                  <InsetPanel
                    style={{
                      background: `color-mix(in oklab, ${ALERT} 9%, transparent)`,
                    }}
                  >
                    <p className="text-[12px] text-muted-foreground">Allergien</p>
                    <p className="text-[15px] font-medium" style={{ color: ALERT }}>
                      {DEMO_PATIENT.allergens.join(", ")}
                    </p>
                  </InsetPanel>
                </div>
              </div>

              <div>
                <SectionTitle>Zielwerte</SectionTitle>
                <TargetList readings={plan.macroReadings} />
              </div>

              <div>
                <SectionTitle>Prinzipien</SectionTitle>
                <PrinciplesPanel />
              </div>

              <div>
                <SectionTitle>Rückmeldung seit Stand 2</SectionTitle>
                <CheckInPanel />
              </div>
            </div>
          )}

          {sheet === "woche" && (
            <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 pt-2 pb-8">
              <div>
                <SectionTitle>Woche</SectionTitle>
                <WeekStrip
                  weekKcal={plan.weekKcal}
                  active={plan.activeDay}
                  target={kcalReading.goal}
                  onSelect={(index) => {
                    plan.setActiveDay(index)
                    setSheet(null)
                  }}
                  onCopy={plan.duplicateDay}
                />
                <p className="mt-2 text-[12px] text-muted-foreground">
                  Tag wählen zum Öffnen, Doppelklick kopiert den offenen Tag dorthin.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <SecondaryButton
                  onClick={() =>
                    plan.duplicateDay(plan.activeDay, ((plan.activeDay + 1) % 7) as DayIndex)
                  }
                >
                  Auf den Folgetag kopieren
                </SecondaryButton>
                <SecondaryButton onClick={() => plan.clearDay()}>Tag leeren</SecondaryButton>
              </div>

              <div>
                <SectionTitle>Übergabe</SectionTitle>
                <ExportPanel week={plan.week} />
              </div>
            </div>
          )}

          {sheet === "freigabe" && (
            <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 pt-2 pb-8">
              <div>
                <p className="text-[20px] font-bold tracking-[-0.015em]">
                  {locked
                    ? `Stand ${release.revision} ist übergeben`
                    : `Stand ${release.revision} freigeben`}
                </p>
                <p className="mt-1 text-[13px] text-muted-foreground">
                  {locked
                    ? "Unveränderlich und für die Klientin sichtbar. Eine Änderung öffnet den nächsten Entwurf."
                    : `Der Stand wird unveränderlich und für die Klientin sichtbar. Bis dahin bleibt Stand ${release.revision - 1} gültig.`}
                </p>
              </div>

              <ReleaseChecklist checks={checks} />

              <div className="flex flex-wrap items-center gap-3">
                {locked ? (
                  <>
                    <span
                      className="flex items-center gap-2 text-[15px] font-semibold"
                      style={{ color: TONE.ok.fill }}
                    >
                      <Lock className="size-4" />
                      Freigegeben
                    </span>
                    <PrimaryButton
                      icon={<PencilLine className="size-4" />}
                      onClick={release.beginRevision}
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

              <div>
                <SectionTitle>Stände</SectionTitle>
                <HistoryPanel
                  history={release.history}
                  currentRevision={release.revision}
                  status={release.status}
                />
              </div>

              <div>
                <SectionTitle>Übergabe</SectionTitle>
                <ExportPanel week={plan.week} />
              </div>
            </div>
          )}
        </DrawerContent>
      </Drawer>
    </div>
  )
}
