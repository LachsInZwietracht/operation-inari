"use client"

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react"
import dynamic from "next/dynamic"
import { useSearchParams } from "next/navigation"
import { addDays, differenceInCalendarDays, differenceInMonths, differenceInYears, parseISO } from "date-fns"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useAnthropometric } from "@/hooks/use-anthropometric"
import { LAB_PARAMETERS } from "@/lib/reference-data/lab-parameters"
import { GROWTH_PERCENTILES } from "@/lib/reference-data/growth-percentiles"
import { AMPUTATION_AREAS } from "@/lib/constants"
import { useDiagnoses } from "@/hooks/use-diagnoses"
import { useMedications } from "@/hooks/use-medications"
import { useLabValues } from "@/hooks/use-lab-values"
import { useActivities } from "@/hooks/use-activities"
import { useReferenceProfiles } from "@/hooks/use-reference-profiles"
import { useScreenings } from "@/hooks/use-screenings"
import { useCounseling } from "@/hooks/use-counseling"
import type {
  AnthropometricEntry,
  DietExclusion,
  DietStyle,
  Food,
  Patient,
} from "@/lib/types"
import { toast } from "sonner"
import { usePatientAllergens } from "@/hooks/use-patient-allergens"
import { usePatients } from "@/hooks/use-patients"
import { usePracticeAppointments } from "@/hooks/use-practice"
import type { AllergenType, AllergenSeverity } from "@/lib/allergen-constants"
import { AnthropometrieTab } from "@/components/patient-tabs/anthropometrie-tab"
import { BeratungenTab } from "@/components/patient-tabs/beratungen-tab"
import { DiagnosenTab } from "@/components/patient-tabs/diagnosen-tab"
import { StammdatenTab } from "@/components/patient-tabs/stammdaten-tab"
import { AktivitaetTab } from "@/components/patient-tabs/aktivitaet-tab"
import { MeasurementDialog } from "@/components/measurement-dialog"
import { PatientIntakePanel } from "@/components/patient-intake-panel"
import { usePatientIntake } from "@/hooks/use-patient-intake"
import { DIET_EXCLUSIONS, resolveDietStyle } from "@/lib/diet-constants"
import { LaborwerteTab } from "@/components/patient-tabs/laborwerte-tab"
import type { PatientWorkspaceData } from "@/lib/data/patient-workspace"
import { calculateEnergy } from "@/lib/nutrition/energy-calculation"

/** Sentinel for "no style selected" — Radix Select rejects an empty value. */
const DIET_STYLE_NONE = "__none__"


const PROFILE_TAB_VALUES = ["stammdaten", "anthropometrie", "diagnosen", "laborwerte", "aktivitaet"] as const
const NUTRITION_TAB_VALUES = ["ernaehrungsplaene"] as const

const KNOWN_TAB_VALUES = new Set<string>([
  "overview",
  "workflow",
  "beratungen",
  "statistiken",
  "klienten-app",
  ...PROFILE_TAB_VALUES,
  ...NUTRITION_TAB_VALUES,
])

const PatientOverviewTab = dynamic(
  () => import("@/components/patient-overview-tab").then((mod) => mod.PatientOverviewTab),
  { ssr: false, loading: () => <div className="h-[420px] rounded-md bg-muted/40" /> },
)
const PatientWorkflowTab = dynamic(
  () => import("@/components/patient-workflow-tab").then((mod) => mod.PatientWorkflowTab),
  { ssr: false },
)
const PatientMealPlansTab = dynamic(
  () => import("@/components/patient-meal-plans-tab").then((mod) => mod.PatientMealPlansTab),
  { ssr: false },
)
const KlientenAppTab = dynamic(
  () => import("@/components/patient-tabs/klienten-app-tab").then((mod) => mod.KlientenAppTab),
  { ssr: false },
)
const PatientStatsTab = dynamic(
  () => import("@/components/patient-stats-tab").then((mod) => mod.PatientStatsTab),
  { ssr: false, loading: () => <div className="h-[320px] rounded-md bg-muted/40" /> },
)
interface PatientTabsProps {
  patient: Patient
  initialData?: PatientWorkspaceData | null
  newMeasurementRequest?: number
}

export function PatientTabs({ patient, initialData, newMeasurementRequest }: PatientTabsProps) {
  const { getPatient, updatePatient } = usePatients({ initialPatients: [patient] })
  const currentPatient = getPatient(patient.id) ?? patient
  const {
    getForPatient: getAnthroForPatient,
    addEntry: addAnthroEntry,
    isLoadingRemote: isLoadingAnthropometric,
  } = useAnthropometric({ initialEntries: initialData?.anthropometrics })
  const {
    getForPatient: getDiagnosesForPatient,
    addEntry: addDiagnosis,
    isLoadingRemote: isLoadingDiagnoses,
  } = useDiagnoses({ initialEntries: initialData?.diagnoses })
  const {
    getForPatient: getMedicationsForPatient,
    addEntry: addMedication,
    isLoadingRemote: isLoadingMedications,
  } = useMedications({ initialEntries: initialData?.medications })
  const {
    getForPatient: getLabValuesForPatient,
    addEntry: addLabValue,
    isLoadingRemote: isLoadingLabValues,
  } = useLabValues({ initialEntries: initialData?.labValues })
  // Read-only: activities are the client's to record, so nothing here writes
  // them. The rows that exist are shown in the statistics and nowhere else.
  const { getForPatient: getActivitiesForPatient } = useActivities({
    initialEntries: initialData?.activities,
  })
  const { getPatientAssignment, setPal } = useReferenceProfiles()
  const { getForPatient: getScreeningsForPatient } = useScreenings({
    initialEntries: initialData?.screenings,
  })
  const {
    getForPatient: getAllergensForPatient,
    addEntry: addAllergen,
    deleteEntry: deleteAllergen,
    isLoadingRemote: isLoadingAllergens,
  } = usePatientAllergens({ initialEntries: initialData?.patientAllergens })
  const {
    sessions: counselingSessions,
    isLoadingRemote: isLoadingCounseling,
  } = useCounseling({ initialSessions: initialData?.counselingSessions })
  const { appointments } = usePracticeAppointments({
    initialAppointments: initialData?.appointments,
  })
  const { links: allIntakeLinks, submissions: allIntakeSubmissions } = usePatientIntake({
    initialLinks: initialData?.intakeLinks,
    initialSubmissions: initialData?.intakeSubmissions,
  })

  const [showAnthroForm, setShowAnthroForm] = useState(false)
  const [showDiagnosisForm, setShowDiagnosisForm] = useState(false)
  const [showMedicationForm, setShowMedicationForm] = useState(false)
  const [diagnosisForm, setDiagnosisForm] = useState({ diagnosis: "", icdCode: "", startDate: "", notes: "" })
  const [medicationForm, setMedicationForm] = useState({
    name: "",
    dosage: "",
    schedule: "",
    startDate: "",
    reason: "",
  })
  const [labParameterId, setLabParameterId] = useState(LAB_PARAMETERS[0]?.id ?? "")
  const [labValueInput, setLabValueInput] = useState("")
  const [labDateInput, setLabDateInput] = useState("")
  const [labNotesInput, setLabNotesInput] = useState("")
  const referenceAssignment = getPatientAssignment(patient.id)
  const palPersisted = referenceAssignment?.palValue != null
  const palValue = palPersisted ? String(referenceAssignment!.palValue) : "1.4"
  const handlePalChange = (value: string) => {
    void setPal(parseFloat(value), patient.id)
  }
  const [targetWeightInput, setTargetWeightInput] = useState("")
  const [calorieDeficitInput, setCalorieDeficitInput] = useState("500")
  const [showAllergenForm, setShowAllergenForm] = useState(false)
  const [allergenForm, setAllergenForm] = useState({
    allergenId: "",
    type: "allergy" as AllergenType,
    severity: "moderate" as AllergenSeverity,
    diagnosedDate: "",
    notes: "",
  })
  const [nutritionPreferenceNotes, setNutritionPreferenceNotes] = useState(
    currentPatient.nutritionPreferenceNotes ?? "",
  )

  const anthroEntries = getAnthroForPatient(patient.id)
  const sessions = counselingSessions.filter(
    (session) => session.patientId === patient.id || session.patientId === patient.legacyId,
  )
  const diagnoses = getDiagnosesForPatient(patient.id)
  const medications = getMedicationsForPatient(patient.id)
  const labEntries = getLabValuesForPatient(patient.id)
  const activities = getActivitiesForPatient(patient.id)
  const screenings = getScreeningsForPatient(patient.id)
  const entriesForSelectedLab = labEntries.filter((entry) => entry.parameterId === labParameterId)
  const anthropometricPending = isLoadingAnthropometric && anthroEntries.length === 0
  const diagnosesPending = isLoadingDiagnoses && diagnoses.length === 0
  const medicationsPending = isLoadingMedications && medications.length === 0
  const labValuesPending = isLoadingLabValues && entriesForSelectedLab.length === 0
  const counselingPending = isLoadingCounseling && sessions.length === 0
  const patientAllergens = getAllergensForPatient(patient.id)
  const intakeSubmissions = allIntakeSubmissions.filter(
    (submission) =>
      submission.patientId === patient.id ||
      submission.patientId === patient.legacyId ||
      submission.appliedPatientId === patient.id ||
      submission.appliedPatientId === patient.legacyId,
  )
  const intakeLinks = allIntakeLinks.filter(
    (link) => link.patientId === patient.id || link.patientId === patient.legacyId,
  )
  const allergensPending = isLoadingAllergens && patientAllergens.length === 0
  const dietExclusions = (currentPatient.nutritionPreferences ?? []).filter(
    (entry): entry is DietExclusion => DIET_EXCLUSIONS.includes(entry as DietExclusion),
  )
  const dietStyle = resolveDietStyle(
    currentPatient.dietStyle,
    currentPatient.nutritionPreferences,
  )
  const nutritionPreferenceAllergens = patientAllergens.filter(
    (entry) => entry.type === "allergy" || entry.type === "intolerance",
  )

  useEffect(() => {
    setNutritionPreferenceNotes(currentPatient.nutritionPreferenceNotes ?? "")
  }, [currentPatient.id, currentPatient.nutritionPreferenceNotes])

  const latestAnthro = anthroEntries.length > 0 ? anthroEntries[anthroEntries.length - 1] : null
  const ageYears = differenceInYears(new Date(), parseISO(patient.dateOfBirth))
  const weight = latestAnthro?.weight ?? 70
  const height = latestAnthro?.height ?? 170
  const pal = parseFloat(palValue)
  const energy = useMemo(
    () =>
      calculateEnergy({
        sex: patient.gender === "m" ? "male" : patient.gender === "w" ? "female" : "diverse",
        formula: "mifflin",
        weightKg: weight,
        heightCm: height,
        ageYears,
        pal,
      }),
    [ageYears, height, pal, patient.gender, weight],
  )
  const basalMetabolicRate = Math.round(energy.basalMetabolicRate)
  const totalEnergyExpenditure = Math.round(energy.totalEnergyExpenditure)

  useEffect(() => {
    if (latestAnthro && !targetWeightInput) {
      setTargetWeightInput((latestAnthro.weight - 5).toFixed(1))
    }
  }, [latestAnthro, targetWeightInput])

  const amputationFactor = useMemo(() => {
    if (!patient.amputations?.length) return 0
    return patient.amputations.reduce((sum, id) => {
      const area = AMPUTATION_AREAS.find((option) => option.id === id)
      return sum + (area?.factor ?? 0)
    }, 0)
  }, [patient.amputations])

  const amputationDescriptions = useMemo(
    () =>
      patient.amputations?.map(
        (id) => AMPUTATION_AREAS.find((option) => option.id === id)?.label ?? id,
      ) ?? [],
    [patient.amputations],
  )

  const getCorrectedBmi = useCallback(
    (entry: AnthropometricEntry) => {
      if (!amputationFactor) return entry.bmi
      const adjustedWeight = entry.weight / (1 - amputationFactor)
      const heightM = entry.height / 100
      return Math.round((adjustedWeight / (heightM * heightM)) * 10) / 10
    },
    [amputationFactor],
  )

  const hasAmputation = amputationFactor > 0
  const correctedWeight = latestAnthro
    ? hasAmputation
      ? latestAnthro.weight / (1 - amputationFactor)
      : latestAnthro.weight
    : null
  const correctedBmi = latestAnthro ? getCorrectedBmi(latestAnthro) : null
  const chartEntries = useMemo(
    () =>
      hasAmputation
        ? anthroEntries.map((entry) => ({ ...entry, bmi: getCorrectedBmi(entry) }))
        : anthroEntries,
    [anthroEntries, getCorrectedBmi, hasAmputation],
  )

  const targetWeightValue = parseFloat(targetWeightInput)
  const calorieDeficit = parseFloat(calorieDeficitInput)
  const weightStart = anthroEntries[0]?.weight ?? latestAnthro?.weight ?? 0

  const weightTrend = useMemo(() => {
    if (anthroEntries.length < 2) return null
    const first = anthroEntries[0]
    const last = anthroEntries[anthroEntries.length - 1]
    const days = Math.max(1, Math.abs(differenceInCalendarDays(parseISO(last.date), parseISO(first.date))))
    const delta = last.weight - first.weight
    const perWeek = (delta / days) * 7
    return {
      totalChange: Math.round(delta * 10) / 10,
      perWeek: Math.round(perWeek * 10) / 10,
      direction: delta === 0 ? "stable" : delta < 0 ? "down" : "up",
      startDate: first.date,
      endDate: last.date,
    }
  }, [anthroEntries])

  const weightProgressPercent = useMemo(() => {
    if (!weightStart || !latestAnthro || !targetWeightValue || weightStart <= targetWeightValue) {
      return 0
    }
    const total = weightStart - targetWeightValue
    const achieved = weightStart - latestAnthro.weight
    return Math.max(0, Math.min(100, (achieved / total) * 100))
  }, [latestAnthro, targetWeightValue, weightStart])

  const weightProjection = useMemo(() => {
    if (!latestAnthro || !targetWeightValue || Number.isNaN(targetWeightValue)) return null
    if (!calorieDeficit || Number.isNaN(calorieDeficit) || calorieDeficit <= 0) return null
    const difference = latestAnthro.weight - targetWeightValue
    if (difference <= 0) {
      return { finished: true, finishDate: parseISO(latestAnthro.date), days: 0 }
    }
    const kcalPerKg = 7700
    const totalKcal = difference * kcalPerKg
    const days = Math.max(1, Math.ceil(totalKcal / calorieDeficit))
    return {
      finished: false,
      finishDate: addDays(parseISO(latestAnthro.date), days),
      days,
    }
  }, [calorieDeficit, latestAnthro, targetWeightValue])

  const isPediatric = ageYears < 18

  const bmiPercentile = useMemo(() => {
    if (!isPediatric || !latestAnthro) return null
    const months = Math.max(0, differenceInMonths(parseISO(latestAnthro.date), parseISO(patient.dateOfBirth)))
    const reference = GROWTH_PERCENTILES.reduce(
      (closest, entry) =>
        Math.abs(entry.ageMonths - months) < Math.abs(closest.ageMonths - months) ? entry : closest,
      GROWTH_PERCENTILES[0],
    )
    const metric = (patient.gender === "m" ? reference.male : reference.female).bmi
    const bmi = latestAnthro.bmi
    const { p3, p10, p25, p50, p75, p90, p97 } = metric
    const bracket =
      bmi < p3
        ? "unter P3"
        : bmi < p10
          ? "P3–P10"
          : bmi < p25
            ? "P10–P25"
            : bmi < p50
              ? "P25–P50"
              : bmi < p75
                ? "P50–P75"
                : bmi < p90
                  ? "P75–P90"
                  : bmi < p97
                    ? "P90–P97"
                    : "über P97"
    return {
      bmi,
      bracket,
      refAgeYears: reference.ageMonths / 12,
    }
  }, [isPediatric, latestAnthro, patient.dateOfBirth, patient.gender])
  const handleAllergenSubmit = useCallback((e: FormEvent) => {
    e.preventDefault()
    if (!allergenForm.allergenId) return
    addAllergen({
      patientId: patient.id,
      allergenId: allergenForm.allergenId,
      type: allergenForm.type,
      severity: allergenForm.severity,
      diagnosedDate: allergenForm.diagnosedDate || undefined,
      notes: allergenForm.notes || undefined,
    })
    setAllergenForm({ allergenId: "", type: "allergy", severity: "moderate", diagnosedDate: "", notes: "" })
    setShowAllergenForm(false)
    toast.success("Allergen gespeichert")
  }, [addAllergen, allergenForm, patient.id])

  const handleDietStyleChange = useCallback(
    (style: string) => {
      const next = style === DIET_STYLE_NONE ? undefined : (style as DietStyle)
      updatePatient(patient.id, { dietStyle: next })
      toast.success("Ernährungsform gespeichert")
    },
    [patient.id, updatePatient],
  )

  const handleDietExclusionChange = useCallback(
    (exclusion: DietExclusion, checked: boolean) => {
      const current = currentPatient.nutritionPreferences ?? []
      const next = checked
        ? Array.from(new Set([...current, exclusion]))
        : current.filter((item) => item !== exclusion)

      updatePatient(patient.id, { nutritionPreferences: next })
      toast.success("Ausschlüsse gespeichert")
    },
    [currentPatient.nutritionPreferences, patient.id, updatePatient],
  )

  const handleNutritionPreferenceNotesBlur = useCallback(() => {
    const nextNotes = nutritionPreferenceNotes.trim()
    if ((currentPatient.nutritionPreferenceNotes ?? "") === nextNotes) return
    updatePatient(patient.id, { nutritionPreferenceNotes: nextNotes || undefined })
    toast.success("Notizen zu Ernährungsvorlieben gespeichert")
  }, [currentPatient.nutritionPreferenceNotes, nutritionPreferenceNotes, patient.id, updatePatient])

  const palOptions = [
    { value: "1.2", label: "1.2 · Ruhig/Büro" },
    { value: "1.4", label: "1.4 · Leichte Aktivität" },
    { value: "1.6", label: "1.6 · Aktiv (Pflege, Handel)" },
    { value: "1.8", label: "1.8 · Sportlich" },
    { value: "2.0", label: "2.0 · Leistungssport" },
  ]


  const handleDiagnosisSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!diagnosisForm.diagnosis.trim()) return
    addDiagnosis({
      patientId: patient.id,
      diagnosis: diagnosisForm.diagnosis.trim(),
      icdCode: diagnosisForm.icdCode || undefined,
      startDate: diagnosisForm.startDate || new Date().toISOString().slice(0, 10),
      notes: diagnosisForm.notes || undefined,
    })
    setDiagnosisForm({ diagnosis: "", icdCode: "", startDate: "", notes: "" })
    setShowDiagnosisForm(false)
  }

  const handleMedicationSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!medicationForm.name.trim()) return
    addMedication({
      patientId: patient.id,
      name: medicationForm.name.trim(),
      dosage: medicationForm.dosage || "",
      schedule: medicationForm.schedule || "",
      startDate: medicationForm.startDate || new Date().toISOString().slice(0, 10),
      reason: medicationForm.reason || undefined,
    })
    setMedicationForm({ name: "", dosage: "", schedule: "", startDate: "", reason: "" })
    setShowMedicationForm(false)
  }

  const handleLabSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!labParameterId || !labValueInput) return
    const numericValue = parseFloat(labValueInput)
    if (Number.isNaN(numericValue)) return
    addLabValue({
      patientId: patient.id,
      parameterId: labParameterId,
      value: numericValue,
      date: labDateInput || new Date().toISOString().slice(0, 10),
      notes: labNotesInput || undefined,
    })
    setLabValueInput("")
    setLabDateInput("")
    setLabNotesInput("")
  }

  const patientAppointments = appointments.filter(
    (appointment) => appointment.patientId === patient.id || appointment.patientId === patient.legacyId,
  )
  const searchParams = useSearchParams()
  const initialTabParam = searchParams.get("tab")
  const initialTab = initialTabParam && KNOWN_TAB_VALUES.has(initialTabParam) ? initialTabParam : "overview"
  const [activeTab, setActiveTab] = useState(initialTab)
  // Recording a measurement is a small, self-contained task: it opens over
  // whatever you were reading instead of moving you to another tab.
  const [measurementOpen, setMeasurementOpen] = useState(false)
  useEffect(() => {
    if (newMeasurementRequest == null) return
    setMeasurementOpen(true)
  }, [newMeasurementRequest])

  const profileTriggerValue = PROFILE_TAB_VALUES.includes(activeTab as (typeof PROFILE_TAB_VALUES)[number])
    ? activeTab
    : "stammdaten"
  const nutritionTriggerValue = NUTRITION_TAB_VALUES.includes(activeTab as (typeof NUTRITION_TAB_VALUES)[number])
    ? activeTab
    : "ernaehrungsplaene"

  const profileSubNav = (
    <TabsList>
      <TabsTrigger value="stammdaten">Profil</TabsTrigger>
      <TabsTrigger value="anthropometrie">Anthropometrie</TabsTrigger>
      <TabsTrigger value="diagnosen">Diagnosen & Medikamente</TabsTrigger>
      <TabsTrigger value="laborwerte">Laborwerte</TabsTrigger>
      <TabsTrigger value="aktivitaet">Aktivität & Energie</TabsTrigger>
    </TabsList>
  )

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab}>
      <TabsList>
        <TabsTrigger value="overview">Übersicht</TabsTrigger>
        <TabsTrigger value="workflow">Ablauf</TabsTrigger>
        <TabsTrigger value={profileTriggerValue}>Profil</TabsTrigger>
        <TabsTrigger value={nutritionTriggerValue}>Ernährung</TabsTrigger>
        <TabsTrigger value="beratungen">Beratung</TabsTrigger>
        <TabsTrigger value="klienten-app">Klienten-App</TabsTrigger>
        <TabsTrigger value="statistiken">Statistiken</TabsTrigger>
      </TabsList>

      <TabsContent value="overview" className="space-y-4">
        <PatientOverviewTab
          patient={currentPatient}
          anthropometrics={anthroEntries}
          appointments={patientAppointments}
          sessions={sessions}
          diagnoses={diagnoses}
          patientAllergens={patientAllergens}
          mealPlans={initialData?.mealPlans ?? []}
          intakeLinks={intakeLinks}
          intakeSubmissions={intakeSubmissions}
          basalMetabolicRate={latestAnthro ? basalMetabolicRate : undefined}
          totalEnergyExpenditure={latestAnthro ? totalEnergyExpenditure : undefined}
          palValue={pal}
          onAddMeasurement={() => setMeasurementOpen(true)}
        />
      </TabsContent>

      <TabsContent value="workflow" className="space-y-4">
        <PatientWorkflowTab
          patient={patient}
          sessions={sessions}
          anthroEntries={anthroEntries}
          screenings={screenings}
          appointments={patientAppointments}
          mealPlans={initialData?.mealPlans ?? []}
          counselingPending={counselingPending}
        />
      </TabsContent>

      <TabsContent value="ernaehrungsplaene" className="space-y-4">
        <PatientMealPlansTab
          patient={patient}
          initialPlans={initialData?.mealPlans ?? []}
          foods={initialData?.mealPlanFoods ?? []}
          recipes={initialData?.recipes ?? []}
        />
      </TabsContent>

      <TabsContent value="stammdaten" className="space-y-4">
        <StammdatenTab
          patient={patient}
          profileSubNav={profileSubNav}
          amputationDescriptions={amputationDescriptions}
          amputationFactor={amputationFactor}
          hasAmputation={hasAmputation}
          latestAnthro={latestAnthro}
          correctedWeight={correctedWeight}
          correctedBmi={correctedBmi}
        />
        <PatientIntakePanel
          patientId={patient.id}
          defaultLabel={`${patient.firstName} ${patient.lastName}`}
        />
      </TabsContent>

      <TabsContent value="anthropometrie" className="space-y-4">
        <AnthropometrieTab
          patient={patient}
          profileSubNav={profileSubNav}
          anthroEntries={anthroEntries}
          chartEntries={chartEntries}
          latestAnthro={latestAnthro}
          anthropometricPending={anthropometricPending}
          isPediatric={isPediatric}
          bmiPercentile={bmiPercentile}
          weightTrend={weightTrend}
          weightProjection={weightProjection}
          weightProgressPercent={weightProgressPercent}
          hasAmputation={hasAmputation}
          amputationFactor={amputationFactor}
          amputationDescriptions={amputationDescriptions}
          correctedBmi={correctedBmi}
          getCorrectedBmi={getCorrectedBmi}
          targetWeightInput={targetWeightInput}
          setTargetWeightInput={setTargetWeightInput}
          calorieDeficitInput={calorieDeficitInput}
          setCalorieDeficitInput={setCalorieDeficitInput}
          showAnthroForm={showAnthroForm}
          setShowAnthroForm={setShowAnthroForm}
          onAddEntry={addAnthroEntry}
        />
      </TabsContent>

      <TabsContent value="diagnosen" className="space-y-4">
        <DiagnosenTab
          profileSubNav={profileSubNav}
          diagnoses={diagnoses}
          diagnosesPending={diagnosesPending}
          showDiagnosisForm={showDiagnosisForm}
          setShowDiagnosisForm={setShowDiagnosisForm}
          diagnosisForm={diagnosisForm}
          setDiagnosisForm={setDiagnosisForm}
          onDiagnosisSubmit={handleDiagnosisSubmit}
          medications={medications}
          medicationsPending={medicationsPending}
          showMedicationForm={showMedicationForm}
          setShowMedicationForm={setShowMedicationForm}
          medicationForm={medicationForm}
          setMedicationForm={setMedicationForm}
          onMedicationSubmit={handleMedicationSubmit}
          patientAllergens={patientAllergens}
          allergensPending={allergensPending}
          showAllergenForm={showAllergenForm}
          setShowAllergenForm={setShowAllergenForm}
          allergenForm={allergenForm}
          setAllergenForm={setAllergenForm}
          onAllergenSubmit={handleAllergenSubmit}
          onDeleteAllergen={deleteAllergen}
        />
      </TabsContent>

      <TabsContent value="laborwerte" className="space-y-4">
        <LaborwerteTab
          patient={patient}
          profileSubNav={profileSubNav}
          labParameterId={labParameterId}
          setLabParameterId={setLabParameterId}
          labValueInput={labValueInput}
          setLabValueInput={setLabValueInput}
          labDateInput={labDateInput}
          setLabDateInput={setLabDateInput}
          labNotesInput={labNotesInput}
          setLabNotesInput={setLabNotesInput}
          entriesForSelectedLab={entriesForSelectedLab}
          labValuesPending={labValuesPending}
          onSubmit={handleLabSubmit}
        />
      </TabsContent>

      <TabsContent value="aktivitaet" className="space-y-4">
        <AktivitaetTab
          patient={patient}
          profileSubNav={profileSubNav}
          basalMetabolicRate={basalMetabolicRate}
          totalEnergyExpenditure={totalEnergyExpenditure}
          palValue={palValue}
          palPersisted={palPersisted}
          palOptions={palOptions}
          onPalChange={handlePalChange}
          dietStyle={dietStyle}
          onDietStyleChange={handleDietStyleChange}
          dietExclusions={dietExclusions}
          onDietExclusionChange={handleDietExclusionChange}
          nutritionPreferenceNotes={nutritionPreferenceNotes}
          setNutritionPreferenceNotes={setNutritionPreferenceNotes}
          onNutritionPreferenceNotesBlur={handleNutritionPreferenceNotesBlur}
          nutritionPreferenceAllergens={nutritionPreferenceAllergens}
          allergensPending={allergensPending}
          onManageAllergens={() => setActiveTab("diagnosen")}
        />
      </TabsContent>

      <TabsContent value="beratungen" className="space-y-4">
        <BeratungenTab patient={patient} sessions={sessions} counselingPending={counselingPending} />
      </TabsContent>

      <TabsContent value="klienten-app" className="space-y-4">
        <KlientenAppTab patient={patient} />
      </TabsContent>

      <TabsContent value="statistiken" className="space-y-4">
        <PatientStatsTab
          patient={patient}
          entries={anthroEntries}
          activities={activities}
          sessions={sessions}
        />
      </TabsContent>

      <MeasurementDialog
        open={measurementOpen}
        onOpenChange={setMeasurementOpen}
        patientId={patient.id}
        defaultHeight={latestAnthro?.height}
        onSubmit={addAnthroEntry}
      />
    </Tabs>
  )
}
