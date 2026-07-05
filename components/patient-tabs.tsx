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
import { useDigitalProtocols } from "@/hooks/use-digital-protocols"
import { useDigitalProtocolSubmissions } from "@/hooks/use-digital-protocol-submissions"
import { useProtocols } from "@/hooks/use-protocols"
import { useCounseling } from "@/hooks/use-counseling"
import type {
  AnthropometricEntry,
  Food,
  NutritionPreference,
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
import { ProtokolleTab } from "@/components/patient-tabs/protokolle-tab"
import { StammdatenTab } from "@/components/patient-tabs/stammdaten-tab"
import { AktivitaetTab } from "@/components/patient-tabs/aktivitaet-tab"
import { LaborwerteTab } from "@/components/patient-tabs/laborwerte-tab"
import type { PatientWorkspaceData } from "@/lib/data/patient-workspace"

const EMPTY_PROTOCOL_FOODS: Food[] = []

const PROFILE_TAB_VALUES = ["stammdaten", "anthropometrie", "diagnosen", "laborwerte", "aktivitaet"] as const
const NUTRITION_TAB_VALUES = ["ernaehrungsplaene", "protokolle"] as const

const KNOWN_TAB_VALUES = new Set<string>([
  "workflow",
  "beratungen",
  "statistiken",
  ...PROFILE_TAB_VALUES,
  ...NUTRITION_TAB_VALUES,
])

const PatientWorkflowTab = dynamic(
  () => import("@/components/patient-workflow-tab").then((mod) => mod.PatientWorkflowTab),
  { ssr: false },
)
const PatientMealPlansTab = dynamic(
  () => import("@/components/patient-meal-plans-tab").then((mod) => mod.PatientMealPlansTab),
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
  const {
    getForPatient: getActivitiesForPatient,
    addEntry: addActivity,
    isLoadingRemote: isLoadingActivities,
  } = useActivities({ initialEntries: initialData?.activities })
  const { getPatientAssignment, setPal } = useReferenceProfiles()
  const { getForPatient: getScreeningsForPatient } = useScreenings({
    initialEntries: initialData?.screenings,
  })
  const {
    getForPatient: getDigitalLinksForPatient,
    generateLink,
    updateStatus: updateDigitalLinkStatus,
    isLoadingRemote: isLoadingDigitalProtocols,
  } = useDigitalProtocols({ initialLinks: initialData?.digitalLinks })
  const { getForPatient: getProtocolsForPatient } = useProtocols(EMPTY_PROTOCOL_FOODS, {
    initialProtocols: initialData?.protocols,
  })
  const {
    submissions: digitalSubmissions,
    isLoading: isLoadingSubmissions,
    updateStatus: updateSubmissionStatus,
  } = useDigitalProtocolSubmissions(patient.id, {
    initialSubmissions: initialData?.digitalSubmissions,
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
  const [activityForm, setActivityForm] = useState({
    type: "Spaziergang",
    durationMinutes: "30",
    intensity: "moderat",
    date: new Date().toISOString().slice(0, 10),
  })
  const [digitalMethod, setDigitalMethod] = useState("Digitales 24h Recall")
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
  const protocols = getProtocolsForPatient(patient.id)
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
  const digitalLinks = getDigitalLinksForPatient(patient.id)
  const activitiesPending = isLoadingActivities && activities.length === 0
  const digitalLinksPending = isLoadingDigitalProtocols && digitalLinks.length === 0
  const patientAllergens = getAllergensForPatient(patient.id)
  const allergensPending = isLoadingAllergens && patientAllergens.length === 0
  const nutritionPreferences = currentPatient.nutritionPreferences ?? []
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
  const basalMetabolicRate = useMemo(() => {
    const genderFactor = patient.gender === "m" ? 5 : patient.gender === "w" ? -161 : -151
    return Math.round(10 * weight + 6.25 * height - 5 * ageYears + genderFactor)
  }, [ageYears, height, patient.gender, weight])
  const totalEnergyExpenditure = Math.round(basalMetabolicRate * pal)
  const activityKcal = activities.reduce((sum, entry) => sum + (entry.energyKcal ?? entry.durationMinutes * 4.5), 0)

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

  const handleNutritionPreferenceChange = useCallback(
    (preference: NutritionPreference, checked: boolean) => {
      const current = currentPatient.nutritionPreferences ?? []
      const next = checked
        ? Array.from(new Set([...current, preference]))
        : current.filter((item) => item !== preference)

      updatePatient(patient.id, { nutritionPreferences: next })
      toast.success("Ernährungsvorlieben gespeichert")
    },
    [currentPatient.nutritionPreferences, patient.id, updatePatient],
  )

  const handleNutritionPreferenceNotesBlur = useCallback(() => {
    const nextNotes = nutritionPreferenceNotes.trim()
    if ((currentPatient.nutritionPreferenceNotes ?? "") === nextNotes) return
    updatePatient(patient.id, { nutritionPreferenceNotes: nextNotes || undefined })
    toast.success("Notizen zu Ernährungsvorlieben gespeichert")
  }, [currentPatient.nutritionPreferenceNotes, nutritionPreferenceNotes, patient.id, updatePatient])

  const digitalMethodOptions = [
    "Digitales 24h Recall",
    "FFQ Link",
    "3-Tages-Protokoll",
    "Haushaltsmengen",
  ]

  const palOptions = [
    { value: "1.2", label: "1.2 · Ruhig/Büro" },
    { value: "1.4", label: "1.4 · Leichte Aktivität" },
    { value: "1.6", label: "1.6 · Aktiv (Pflege, Handel)" },
    { value: "1.8", label: "1.8 · Sportlich" },
    { value: "2.0", label: "2.0 · Leistungssport" },
  ]

  const protocolComparison = useMemo(() => protocols.slice(0, 2), [protocols])
  const comparisonMetrics = [
    { key: "energie", label: "Energie", unit: "kcal" },
    { key: "eiweiss", label: "Eiweiß", unit: "g" },
    { key: "fett", label: "Fett", unit: "g" },
    { key: "kohlenhydrate", label: "Kohlenhydrate", unit: "g" },
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

  const handleActivitySubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const duration = Number(activityForm.durationMinutes) || 30
    const estimatedEnergy = Math.round((duration / 60) * weight * 5)
    addActivity({
      patientId: patient.id,
      type: activityForm.type,
      durationMinutes: duration,
      intensity: activityForm.intensity,
      date: activityForm.date || new Date().toISOString().slice(0, 10),
      pal,
      energyKcal: estimatedEnergy,
    })
    setActivityForm((prev) => ({ ...prev, type: "", durationMinutes: "30" }))
  }

  const patientAppointments = appointments.filter(
    (appointment) => appointment.patientId === patient.id || appointment.patientId === patient.legacyId,
  )
  const searchParams = useSearchParams()
  const initialTabParam = searchParams.get("tab")
  const initialTab = initialTabParam && KNOWN_TAB_VALUES.has(initialTabParam) ? initialTabParam : "workflow"
  const [activeTab, setActiveTab] = useState(initialTab)
  useEffect(() => {
    if (newMeasurementRequest == null) return
    setActiveTab("anthropometrie")
    setShowAnthroForm(true)
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
        <TabsTrigger value="workflow">Workflow</TabsTrigger>
        <TabsTrigger value={profileTriggerValue}>Profil</TabsTrigger>
        <TabsTrigger value={nutritionTriggerValue}>Ernährung</TabsTrigger>
        <TabsTrigger value="beratungen">Beratung</TabsTrigger>
        <TabsTrigger value="statistiken">Statistiken</TabsTrigger>
      </TabsList>

      <TabsContent value="workflow" className="space-y-4">
        <PatientWorkflowTab
          patient={patient}
          protocols={protocols}
          digitalLinks={digitalLinks}
          digitalSubmissions={digitalSubmissions}
          sessions={sessions}
          anthroEntries={anthroEntries}
          screenings={screenings}
          appointments={patientAppointments}
          mealPlans={initialData?.mealPlans ?? []}
          onGenerateLink={() =>
            void generateLink({
              patientId: patient.id,
              method: digitalMethod,
              status: "pending",
              expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
            })
          }
          onMarkSubmissionReviewed={(submissionId) => void updateSubmissionStatus(submissionId, "reviewed")}
          isLoadingSubmissions={isLoadingSubmissions}
          digitalLinksPending={digitalLinksPending}
          counselingPending={counselingPending}
        />
      </TabsContent>

      <TabsContent value="ernaehrungsplaene" className="space-y-4">
        <TabsList>
          <TabsTrigger value="ernaehrungsplaene">Ernährungspläne</TabsTrigger>
          <TabsTrigger value="protokolle">Protokolle</TabsTrigger>
        </TabsList>
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
          activityKcal={activityKcal}
          palValue={palValue}
          palPersisted={palPersisted}
          palOptions={palOptions}
          onPalChange={handlePalChange}
          activityForm={activityForm}
          setActivityForm={setActivityForm}
          onActivitySubmit={handleActivitySubmit}
          activities={activities}
          activitiesPending={activitiesPending}
          nutritionPreferences={nutritionPreferences}
          onNutritionPreferenceChange={handleNutritionPreferenceChange}
          nutritionPreferenceNotes={nutritionPreferenceNotes}
          setNutritionPreferenceNotes={setNutritionPreferenceNotes}
          onNutritionPreferenceNotesBlur={handleNutritionPreferenceNotesBlur}
          nutritionPreferenceAllergens={nutritionPreferenceAllergens}
          allergensPending={allergensPending}
          onManageAllergens={() => setActiveTab("diagnosen")}
        />
      </TabsContent>

      <TabsContent value="protokolle" className="space-y-4">
        <ProtokolleTab
          patient={patient}
          protocols={protocols}
          protocolComparison={protocolComparison}
          comparisonMetrics={comparisonMetrics}
          digitalMethod={digitalMethod}
          setDigitalMethod={setDigitalMethod}
          digitalMethodOptions={digitalMethodOptions}
          onGenerateLink={() =>
            void generateLink({
              patientId: patient.id,
              method: digitalMethod,
              status: "pending",
              expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
            })
          }
          digitalLinks={digitalLinks}
          digitalLinksPending={digitalLinksPending}
          onUpdateLinkStatus={updateDigitalLinkStatus}
          digitalSubmissions={digitalSubmissions}
          isLoadingSubmissions={isLoadingSubmissions}
          onMarkSubmissionReviewed={(submissionId) => void updateSubmissionStatus(submissionId, "reviewed")}
        />
      </TabsContent>

      <TabsContent value="beratungen" className="space-y-4">
        <BeratungenTab patient={patient} sessions={sessions} counselingPending={counselingPending} />
      </TabsContent>

      <TabsContent value="statistiken" className="space-y-4">
        <PatientStatsTab
          patient={patient}
          entries={anthroEntries}
          activities={activities}
          sessions={sessions}
        />
      </TabsContent>
    </Tabs>
  )
}
