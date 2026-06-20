"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { differenceInYears, parseISO } from "date-fns";
import {
  RadialBar,
  RadialBarChart,
  PolarAngleAxis,
  ResponsiveContainer,
} from "recharts";
import {
  Activity,
  Flame,
  Target,
  TrendingDown,
  TrendingUp,
  Minus,
  Mars,
  Venus,
  UserRound,
  Save,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatNumber } from "@/lib/format";
import { usePatients } from "@/hooks/use-patients";
import { useAnthropometric } from "@/hooks/use-anthropometric";
import { useReferenceProfiles } from "@/hooks/use-reference-profiles";
import type { AnthropometricEntry, Patient } from "@/lib/types";

type Sex = "male" | "female";
type Formula = "mifflin" | "harris";

const GENERAL_OPTION = "__general__";

interface ActivityLevel {
  id: string;
  pal: number;
  label: string;
  hint: string;
}

// PAL values intentionally align with the patient energy panel
// (components/patient-tabs.tsx) so they round-trip through
// patient_reference_assignments.pal_value.
const ACTIVITY_LEVELS: ActivityLevel[] = [
  { id: "resting", pal: 1.2, label: "Ruhig / Büro", hint: "Überwiegend sitzend, kaum Bewegung" },
  { id: "light", pal: 1.4, label: "Leichte Aktivität", hint: "Leichter Sport 1–3× pro Woche" },
  { id: "active", pal: 1.6, label: "Aktiv", hint: "Pflege, Handel, Sport 3–5× pro Woche" },
  { id: "sporty", pal: 1.8, label: "Sportlich", hint: "Intensiver Sport 6–7× pro Woche" },
  { id: "athlete", pal: 2.0, label: "Leistungssport", hint: "Tägliches hartes Training / körperliche Arbeit" },
];

const DEFAULT_ACTIVITY_ID = "light";

function activityIdForPal(pal: number): string {
  let best = ACTIVITY_LEVELS[0];
  for (const level of ACTIVITY_LEVELS) {
    if (Math.abs(level.pal - pal) < Math.abs(best.pal - pal)) best = level;
  }
  return best.id;
}

interface MacroPreset {
  id: string;
  label: string;
  carbs: number;
  fat: number;
  protein: number;
}

const MACRO_PRESETS: MacroPreset[] = [
  { id: "balanced", label: "Ausgewogen", carbs: 50, fat: 30, protein: 20 },
  { id: "lowcarb", label: "Low Carb", carbs: 30, fat: 40, protein: 30 },
  { id: "protein", label: "Eiweißreich", carbs: 35, fat: 30, protein: 35 },
  { id: "keto", label: "Ketogen", carbs: 5, fat: 70, protein: 25 },
];

const MACROS = [
  { key: "carbs" as const, label: "Kohlenhydrate", kcalPerGram: 4, color: "var(--chart-3)" },
  { key: "fat" as const, label: "Fett", kcalPerGram: 9, color: "var(--chart-2)" },
  { key: "protein" as const, label: "Eiweiß", kcalPerGram: 4, color: "var(--chart-1)" },
];

const KCAL_PER_KG = 7700;

function bmrFor(sex: Sex, formula: Formula, weight: number, height: number, age: number): number {
  if (formula === "harris") {
    return sex === "male"
      ? 88.362 + 13.397 * weight + 4.799 * height - 5.677 * age
      : 447.593 + 9.247 * weight + 3.098 * height - 4.33 * age;
  }
  const base = 10 * weight + 6.25 * height - 5 * age;
  return sex === "male" ? base + 5 : base - 161;
}

function sexForGender(gender: Patient["gender"]): Sex {
  return gender === "m" ? "male" : "female";
}

function patientLabel(patient: Patient): string {
  return `${patient.lastName}, ${patient.firstName}`;
}

function latestEntry(entries: AnthropometricEntry[]): AnthropometricEntry | null {
  return entries.length > 0 ? entries[entries.length - 1] : null;
}

export default function KalorienrechnerPage() {
  const searchParams = useSearchParams();
  const { patients, getPatient, updatePatient } = usePatients();
  const { getForPatient, addEntry, isLoadingRemote: anthroLoading } = useAnthropometric();
  const {
    getPatientAssignment,
    isLoadingRemote: isLoadingReferenceProfiles,
    setPal,
  } = useReferenceProfiles();

  const [selectedPatientId, setSelectedPatientId] = useState<string>(GENERAL_OPTION);
  const [sex, setSex] = useState<Sex>("male");
  const [age, setAge] = useState(35);
  const [weight, setWeight] = useState(75);
  const [height, setHeight] = useState(178);
  const [activityId, setActivityId] = useState(DEFAULT_ACTIVITY_ID);
  const [formula, setFormula] = useState<Formula>("mifflin");
  const [calorieDelta, setCalorieDelta] = useState(0);
  const [presetId, setPresetId] = useState("balanced");
  const [goalWeight, setGoalWeight] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);

  const activity = ACTIVITY_LEVELS.find((a) => a.id === activityId) ?? ACTIVITY_LEVELS[2];
  const preset = MACRO_PRESETS.find((p) => p.id === presetId) ?? MACRO_PRESETS[0];
  const selectedPatient = selectedPatientId === GENERAL_OPTION ? null : getPatient(selectedPatientId);

  // Apply a patient's stored values to the calculator once, when the patient is
  // selected and their data is available. A ref guards against re-applying on
  // every render (which would clobber the user's edits).
  const appliedPatientRef = useRef<string | null>(null);
  const applyPatient = useCallback(
    (patient: Patient) => {
      const entries = getForPatient(patient.id);
      const latest = latestEntry(entries);
      const nextSex = sexForGender(patient.gender);
      const nextWeight = latest?.weight ?? weight;
      const nextHeight = latest?.height ?? height;
      const nextAge = patient.dateOfBirth
        ? differenceInYears(new Date(), parseISO(patient.dateOfBirth))
        : age;
      const assignment = getPatientAssignment(patient.id);
      const nextActivityId =
        assignment?.palValue != null ? activityIdForPal(assignment.palValue) : DEFAULT_ACTIVITY_ID;
      const nextActivity =
        ACTIVITY_LEVELS.find((a) => a.id === nextActivityId) ?? activity;
      const nextPresetId = patient.macroPreset ?? presetId;

      setSex(nextSex);
      setWeight(Math.round(nextWeight));
      setHeight(Math.round(nextHeight));
      setAge(nextAge);
      setActivityId(nextActivityId);
      setPresetId(nextPresetId);
      setGoalWeight(patient.goalWeight != null ? String(patient.goalWeight) : "");

      if (patient.dailyCalorieGoal != null) {
        const tdee = bmrFor(nextSex, formula, nextWeight, nextHeight, nextAge) * nextActivity.pal;
        const delta = Math.max(-1000, Math.min(1000, Math.round((patient.dailyCalorieGoal - tdee) / 50) * 50));
        setCalorieDelta(delta);
      } else {
        setCalorieDelta(0);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally reads current values at apply time
    [getForPatient, getPatientAssignment, formula],
  );

  // Preselect from ?patientId= deep link (once patients are loaded).
  const deepLinkPatientId = searchParams.get("patientId");
  useEffect(() => {
    if (!deepLinkPatientId) return;
    if (selectedPatientId !== GENERAL_OPTION) return;
    if (getPatient(deepLinkPatientId)) {
      setSelectedPatientId(deepLinkPatientId);
    }
  }, [deepLinkPatientId, getPatient, selectedPatientId]);

  // Apply patient data once it is available.
  useEffect(() => {
    if (selectedPatientId === GENERAL_OPTION) {
      appliedPatientRef.current = null;
      return;
    }
    if (appliedPatientRef.current === selectedPatientId) return;
    // Wait for weigh-ins to finish syncing so we apply real measurements
    // rather than the calculator defaults.
    if (anthroLoading || isLoadingReferenceProfiles) return;
    const patient = getPatient(selectedPatientId);
    if (!patient) return;
    appliedPatientRef.current = selectedPatientId;
    applyPatient(patient);
  }, [selectedPatientId, patients, getPatient, applyPatient, anthroLoading, isLoadingReferenceProfiles]);

  const result = useMemo(() => {
    const bmr = Math.max(0, bmrFor(sex, formula, weight, height, age));
    const tdee = bmr * activity.pal;
    const target = Math.max(0, tdee + calorieDelta);
    const weeklyKg = (calorieDelta * 7) / KCAL_PER_KG;
    const bmi = height > 0 ? weight / Math.pow(height / 100, 2) : 0;

    const macros = MACROS.map((m) => {
      const pct = preset[m.key];
      const kcal = (target * pct) / 100;
      return { ...m, pct, kcal, grams: kcal / m.kcalPerGram };
    });

    return { bmr, tdee, target, weeklyKg, bmi, macros };
  }, [sex, formula, weight, height, age, activity.pal, calorieDelta, preset]);

  const goal =
    calorieDelta < -50
      ? { label: "Abnehmen", icon: TrendingDown, tone: "text-sky-500" }
      : calorieDelta > 50
        ? { label: "Aufbauen", icon: TrendingUp, tone: "text-emerald-500" }
        : { label: "Gewicht halten", icon: Minus, tone: "text-muted-foreground" };

  const gaugeData = [
    { name: "target", value: Math.min(100, (result.target / 4000) * 100), fill: "var(--chart-1)" },
  ];

  const bmiCategory =
    result.bmi < 18.5
      ? "Untergewicht"
      : result.bmi < 25
        ? "Normalgewicht"
        : result.bmi < 30
          ? "Übergewicht"
          : "Adipositas";

  const handleSaveToPatient = useCallback(async () => {
    if (!selectedPatient) return;
    setIsSaving(true);
    try {
      const parsedGoalWeight = goalWeight.trim() === "" ? undefined : Number(goalWeight);
      updatePatient(selectedPatient.id, {
        dailyCalorieGoal: Math.round(result.target),
        goalWeight: parsedGoalWeight != null && !Number.isNaN(parsedGoalWeight) ? parsedGoalWeight : undefined,
        macroPreset: presetId,
      });

      // PAL lives on the reference assignment, shared with the patient panel.
      await setPal(activity.pal, selectedPatient.id);

      // Record a new dated weigh-in only when weight/height actually changed.
      const latest = latestEntry(getForPatient(selectedPatient.id));
      if (!latest || latest.weight !== weight || latest.height !== height) {
        const bmi = height > 0 ? Math.round((weight / Math.pow(height / 100, 2)) * 10) / 10 : 0;
        addEntry({
          patientId: selectedPatient.id,
          date: new Date().toISOString().slice(0, 10),
          weight,
          height,
          bmi,
        });
      }

      toast.success(`In Patientenakte gespeichert: ${patientLabel(selectedPatient)}`);
    } catch (error) {
      console.error("Failed to save calorie target to patient:", error);
      toast.error("Speichern fehlgeschlagen. Bitte erneut versuchen.");
    } finally {
      setIsSaving(false);
    }
  }, [selectedPatient, goalWeight, result.target, presetId, setPal, activity.pal, getForPatient, weight, height, addEntry, updatePatient]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Kalorienrechner"
        description="Schätzen Sie Grundumsatz, Gesamtbedarf und eine passende Makronährstoff-Verteilung für die Beratung."
        helpText="Der Grundumsatz wird nach Mifflin-St Jeor bzw. Harris-Benedict berechnet, der Gesamtbedarf über den PAL-Faktor. Die Werte sind Schätzungen und ersetzen keine individuelle klinische Beurteilung."
      >
        <div className="flex items-center gap-2">
          <UserRound className="h-4 w-4 text-muted-foreground" />
          <Select value={selectedPatientId} onValueChange={setSelectedPatientId}>
            <SelectTrigger className="w-[240px]">
              <SelectValue placeholder="Patient wählen" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={GENERAL_OPTION}>Ohne Patient (Allgemein)</SelectItem>
              {patients.map((patient) => (
                <SelectItem key={patient.id} value={patient.id}>
                  {patientLabel(patient)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </PageHeader>

      {selectedPatient && (
        <p className="text-sm text-muted-foreground">
          Werte aus der Akte von{" "}
          <span className="font-medium text-foreground">{patientLabel(selectedPatient)}</span>{" "}
          übernommen. Änderungen wirken sich erst beim Speichern auf die Akte aus.
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        {/* Inputs */}
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="h-4 w-4 text-primary" />
              Angaben
            </CardTitle>
            <CardDescription>Körperdaten und Aktivität erfassen</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Sex */}
            <div className="space-y-2">
              <Label>Geschlecht</Label>
              <div className="grid grid-cols-2 gap-2">
                {([
                  { id: "male" as const, label: "Männlich", icon: Mars },
                  { id: "female" as const, label: "Weiblich", icon: Venus },
                ]).map((opt) => {
                  const active = sex === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setSex(opt.id)}
                      aria-pressed={active}
                      className={cn(
                        "flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors",
                        active
                          ? "border-primary bg-primary/10 text-foreground"
                          : "border-border text-muted-foreground hover:bg-muted/60",
                      )}
                    >
                      <opt.icon className="h-4 w-4" />
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <SliderField label="Alter" unit="Jahre" value={age} min={14} max={100} onChange={setAge} />
            <SliderField label="Gewicht" unit="kg" value={weight} min={35} max={200} onChange={setWeight} />
            <SliderField label="Körpergröße" unit="cm" value={height} min={120} max={220} onChange={setHeight} />

            <Separator />

            {/* Activity */}
            <div className="space-y-2">
              <Label htmlFor="activity">Aktivitätsniveau</Label>
              <Select value={activityId} onValueChange={setActivityId}>
                <SelectTrigger id="activity">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ACTIVITY_LEVELS.map((level) => (
                    <SelectItem key={level.id} value={level.id}>
                      <span className="flex flex-col">
                        <span>{level.label} · PAL {formatNumber(level.pal, 2)}</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{activity.hint}</p>
            </div>

            {/* Formula */}
            <div className="space-y-2">
              <Label>Berechnungsformel</Label>
              <div className="grid grid-cols-2 gap-2">
                {([
                  { id: "mifflin" as const, label: "Mifflin-St Jeor" },
                  { id: "harris" as const, label: "Harris-Benedict" },
                ]).map((opt) => {
                  const active = formula === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setFormula(opt.id)}
                      aria-pressed={active}
                      className={cn(
                        "rounded-lg border px-3 py-2 text-xs font-medium transition-colors",
                        active
                          ? "border-primary bg-primary/10 text-foreground"
                          : "border-border text-muted-foreground hover:bg-muted/60",
                      )}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        <div className="space-y-6">
          {/* Hero gauge */}
          <Card className="relative overflow-hidden border-primary/20">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-chart-2/10"
            />
            <CardContent className="relative grid items-center gap-4 p-6 sm:grid-cols-[180px_minmax(0,1fr)]">
              <div className="relative mx-auto h-[180px] w-[180px]">
                <ResponsiveContainer width="100%" height="100%">
                  <RadialBarChart
                    innerRadius="78%"
                    outerRadius="100%"
                    data={gaugeData}
                    startAngle={90}
                    endAngle={-270}
                  >
                    <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                    <RadialBar dataKey="value" cornerRadius={16} background={{ fill: "var(--muted)" }} />
                  </RadialBarChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <Flame className="mb-1 h-5 w-5 text-primary" />
                  <span className="text-3xl font-bold tabular-nums leading-none">
                    {formatNumber(Math.round(result.target))}
                  </span>
                  <span className="text-xs text-muted-foreground">kcal / Tag</span>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <goal.icon className={cn("h-4 w-4", goal.tone)} />
                  <span className="text-sm font-medium">{goal.label}</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Tagesbedarf bei diesem Ziel. {" "}
                  {Math.abs(result.weeklyKg) >= 0.01 && (
                    <>
                      Prognose:{" "}
                      <span className="font-medium text-foreground">
                        {result.weeklyKg > 0 ? "+" : "−"}
                        {formatNumber(Math.abs(result.weeklyKg), 2)} kg / Woche
                      </span>
                      .
                    </>
                  )}
                </p>
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <Stat label="Grundumsatz" value={`${formatNumber(Math.round(result.bmr))}`} unit="kcal" />
                  <Stat label="Gesamtbedarf" value={`${formatNumber(Math.round(result.tdee))}`} unit="kcal" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Goal slider */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Target className="h-4 w-4 text-primary" />
                Ziel anpassen
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Kalorienbilanz</span>
                  <span className="font-semibold tabular-nums">
                    {calorieDelta > 0 ? "+" : ""}
                    {formatNumber(calorieDelta)} kcal
                  </span>
                </div>
                <Slider
                  value={[calorieDelta]}
                  min={-1000}
                  max={1000}
                  step={50}
                  onValueChange={(v) => setCalorieDelta(v[0])}
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>−1000 (Defizit)</span>
                  <span>Erhalt</span>
                  <span>+1000 (Überschuss)</span>
                </div>
              </div>
              <Separator />
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="goal-weight" className="text-sm">Zielgewicht</Label>
                <div className="flex items-center gap-1">
                  <Input
                    id="goal-weight"
                    type="number"
                    inputMode="decimal"
                    placeholder="–"
                    value={goalWeight}
                    onChange={(e) => setGoalWeight(e.target.value)}
                    className="h-8 w-24 text-right tabular-nums"
                  />
                  <span className="w-8 text-xs text-muted-foreground">kg</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Macros */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-base">Makronährstoffe</CardTitle>
            <CardDescription>Verteilung des Tagesbedarfs</CardDescription>
          </div>
          <Select value={presetId} onValueChange={setPresetId}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MACRO_PRESETS.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Stacked bar */}
          <div className="flex h-3 w-full overflow-hidden rounded-full">
            {result.macros.map((m) => (
              <div key={m.key} style={{ width: `${m.pct}%`, backgroundColor: m.color }} />
            ))}
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {result.macros.map((m) => (
              <div key={m.key} className="rounded-lg border p-4">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: m.color }} />
                  <span className="text-sm font-medium">{m.label}</span>
                  <span className="ml-auto text-xs text-muted-foreground">{m.pct} %</span>
                </div>
                <p className="mt-2 text-2xl font-bold tabular-nums">
                  {formatNumber(Math.round(m.grams))}
                  <span className="ml-1 text-sm font-normal text-muted-foreground">g</span>
                </p>
                <p className="text-xs text-muted-foreground">{formatNumber(Math.round(m.kcal))} kcal</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* BMI + save */}
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-4 p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">BMI</span>
              <span className="text-lg font-bold tabular-nums">{formatNumber(result.bmi, 1)}</span>
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium">{bmiCategory}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Schätzwerte ohne klinische Gewähr · Formel: {formula === "mifflin" ? "Mifflin-St Jeor" : "Harris-Benedict"}
            </p>
          </div>
          <Button
            type="button"
            onClick={handleSaveToPatient}
            disabled={!selectedPatient || isSaving}
          >
            <Save className="h-4 w-4" />
            {selectedPatient ? "Im Patienten speichern" : "Patient wählen zum Speichern"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="rounded-lg border bg-card/50 px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold tabular-nums">
        {value}
        <span className="ml-1 text-xs font-normal text-muted-foreground">{unit}</span>
      </p>
    </div>
  );
}

function SliderField({
  label,
  unit,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  unit: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  const clamp = (n: number) => Math.min(max, Math.max(min, n));
  const [draftValue, setDraftValue] = useState(String(value));

  useEffect(() => {
    setDraftValue(String(value));
  }, [value]);

  const commitDraftValue = () => {
    const parsed = Number(draftValue);
    const nextValue = draftValue.trim() === "" || Number.isNaN(parsed) ? value : clamp(Math.round(parsed));
    onChange(nextValue);
    setDraftValue(String(nextValue));
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        <div className="flex items-center gap-1">
          <Input
            type="number"
            value={draftValue}
            min={min}
            max={max}
            onChange={(e) => {
              const nextDraftValue = e.target.value;
              setDraftValue(nextDraftValue);

              if (nextDraftValue.trim() === "") return;
              const parsed = Number(nextDraftValue);
              if (Number.isNaN(parsed) || parsed < min || parsed > max) return;

              onChange(Math.round(parsed));
            }}
            onBlur={commitDraftValue}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.currentTarget.blur();
              }
            }}
            className="h-8 w-20 text-right tabular-nums"
          />
          <span className="w-10 text-xs text-muted-foreground">{unit}</span>
        </div>
      </div>
      <Slider value={[value]} min={min} max={max} step={1} onValueChange={(v) => onChange(v[0])} />
    </div>
  );
}
