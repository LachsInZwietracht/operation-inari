"use client"

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react"
import Link from "next/link"
import {
  Activity as ActivityIcon,
  CheckCircle2,
  FlaskConical,
  HeartPulse,
  Pill,
  Plus,
  QrCode,
  Stethoscope,
} from "lucide-react"
import { addDays, differenceInCalendarDays, differenceInMonths, differenceInYears, parseISO } from "date-fns"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Progress } from "@/components/ui/progress"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { AnthropometricChart } from "@/components/anthropometric-chart"
import { AnthropometricForm } from "@/components/anthropometric-form"
import { PediatricPercentileChart } from "@/components/pediatric-percentile-chart"
import {
  AllergenAutomationCard,
  DiabetesAnalyticsCard,
  DietCatalogCard,
  KetogenicPlannerCard,
} from "@/components/therapy-panels"
import { GuidedProtocolAssistant } from "@/components/guided-protocol-assistant"
import { formatDate, formatNumber } from "@/lib/format"
import { downloadCsv } from "@/lib/utils"
import { useAnthropometric } from "@/hooks/use-anthropometric"
import {
  COUNSELING_SESSIONS,
  LAB_PARAMETERS,
  GROWTH_PERCENTILES,
} from "@/lib/mock-data"
import { AMPUTATION_AREAS, PROTOCOL_TYPE_LABELS } from "@/lib/constants"
import { useDiagnoses } from "@/hooks/use-diagnoses"
import { useMedications } from "@/hooks/use-medications"
import { useLabValues } from "@/hooks/use-lab-values"
import { useActivities } from "@/hooks/use-activities"
import { useTherapySettings } from "@/hooks/use-therapy-settings"
import { useTherapyIntegrations } from "@/hooks/use-therapy-integrations"
import { useScreenings } from "@/hooks/use-screenings"
import { useProcam } from "@/hooks/use-procam"
import { useDigitalProtocols } from "@/hooks/use-digital-protocols"
import { useProtocols } from "@/hooks/use-protocols"
import type { Patient, AnthropometricEntry } from "@/lib/types"
import { toast } from "sonner"

function complianceBadge(value: number, min?: number, max?: number): "ok" | "low" | "high" {
  if (typeof min === "number" && value < min) return "low"
  if (typeof max === "number" && value > max) return "high"
  return "ok"
}

const MNA_QUESTIONS = [
  {
    id: "appetite",
    label: "Appetitverlust (3 Monate)",
    options: [
      { label: "Kein Verlust", value: 2 },
      { label: "Leichter Verlust", value: 1 },
      { label: "Starker Verlust", value: 0 },
    ],
  },
  {
    id: "weightLoss",
    label: "Unbeabsichtigter Gewichtsverlust",
    options: [
      { label: "< 1 kg", value: 3 },
      { label: "1–3 kg", value: 2 },
      { label: "> 3 kg", value: 1 },
      { label: "> 5 kg", value: 0 },
    ],
  },
  {
    id: "mobility",
    label: "Mobilität",
    options: [
      { label: "Regelmäßig aktiv", value: 2 },
      { label: "Eigenständig mobil", value: 1 },
      { label: "Bettruhe / Rollstuhl", value: 0 },
    ],
  },
  {
    id: "stress",
    label: "Psychischer Stress oder akute Erkrankung",
    options: [
      { label: "Nein", value: 2 },
      { label: "Ja", value: 0 },
    ],
  },
  {
    id: "neuro",
    label: "Neuropsychologischer Zustand",
    options: [
      { label: "Normal", value: 2 },
      { label: "Leichte Demenz", value: 1 },
      { label: "Schwere Demenz", value: 0 },
    ],
  },
  {
    id: "calf",
    label: "Wadenumfang",
    options: [
      { label: "> 31 cm", value: 3 },
      { label: "≤ 31 cm", value: 0 },
    ],
  },
] as const

const SGA_QUESTIONS = [
  {
    id: "weight",
    label: "Gewichtsverlauf",
    options: [
      { id: "stable", label: "< 5 % Verlust", score: 0 },
      { id: "moderate", label: "5–10 % Verlust", score: 1 },
      { id: "severe", label: "> 10 % Verlust", score: 2 },
    ],
  },
  {
    id: "intake",
    label: "Ernährungsaufnahme",
    options: [
      { id: "normal", label: "Keine Änderung", score: 0 },
      { id: "mild", label: "Leichte Reduktion", score: 1 },
      { id: "severe", label: "Kaum Aufnahme", score: 2 },
    ],
  },
  {
    id: "gi",
    label: "Gastrointestinale Symptome",
    options: [
      { id: "none", label: "Keine", score: 0 },
      { id: "moderate", label: "Übelkeit/Durchfall", score: 1 },
      { id: "heavy", label: "Persistierend > 2 Wochen", score: 2 },
    ],
  },
  {
    id: "function",
    label: "Funktioneller Status",
    options: [
      { id: "full", label: "Voll aktiv", score: 0 },
      { id: "reduced", label: "Reduziert", score: 1 },
      { id: "bed", label: "Bettruhe", score: 2 },
    ],
  },
  {
    id: "exam",
    label: "Klinische Untersuchung",
    options: [
      { id: "normal", label: "Normale Fett-/Muskelmasse", score: 0 },
      { id: "moderate", label: "Mäßige Verluste", score: 1 },
      { id: "advanced", label: "Ausgeprägte Verluste", score: 2 },
    ],
  },
] as const

interface PatientTabsProps {
  patient: Patient
}

export function PatientTabs({ patient }: PatientTabsProps) {
  const { getForPatient: getAnthroForPatient, addEntry: addAnthroEntry } = useAnthropometric()
  const { getForPatient: getDiagnosesForPatient, addEntry: addDiagnosis } = useDiagnoses()
  const { getForPatient: getMedicationsForPatient, addEntry: addMedication } = useMedications()
  const { getForPatient: getLabValuesForPatient, addEntry: addLabValue } = useLabValues()
  const { getForPatient: getActivitiesForPatient, addEntry: addActivity } = useActivities()
  const { getForPatient: getTherapiesForPatient, upsertSetting } = useTherapySettings()
  const {
    getForPatient: getIntegrationsForPatient,
    addIntegration,
    updateIntegration,
  } = useTherapyIntegrations()
  const { getForPatient: getScreeningsForPatient, addEntry: addScreening } = useScreenings()
  const { getForPatient: getProcamForPatient, addResult: addProcam } = useProcam()
  const { getForPatient: getDigitalLinksForPatient, generateLink, updateStatus } = useDigitalProtocols()
  const { getForPatient: getProtocolsForPatient } = useProtocols()

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
  const [palValue, setPalValue] = useState("1.4")
  const [activityForm, setActivityForm] = useState({
    type: "Spaziergang",
    durationMinutes: "30",
    intensity: "moderat",
    date: new Date().toISOString().slice(0, 10),
  })
  const [digitalMethod, setDigitalMethod] = useState("Digitales 24h Recall")
  const [mustScore, setMustScore] = useState(1)
  const [nrsScore, setNrsScore] = useState(2)
  const [procamForm, setProcamForm] = useState({
    age: 55,
    ldl: 140,
    hdl: 45,
    systolic: 130,
    smoker: false,
  })
  const [targetWeightInput, setTargetWeightInput] = useState("")
  const [calorieDeficitInput, setCalorieDeficitInput] = useState("500")
  const [calculatorTab, setCalculatorTab] = useState("creatinine")
  const [creatinineInput, setCreatinineInput] = useState("1.0")
  const [mnaInputs, setMnaInputs] = useState<Record<string, number>>({})
  const [sgaInputs, setSgaInputs] = useState<Record<string, string>>({})

  const anthroEntries = getAnthroForPatient(patient.id)
  const sessions = COUNSELING_SESSIONS.filter((s) => s.patientId === patient.id)
  const protocols = getProtocolsForPatient(patient.id)
  const diagnoses = getDiagnosesForPatient(patient.id)
  const medications = getMedicationsForPatient(patient.id)
  const labEntries = getLabValuesForPatient(patient.id)
  const activities = getActivitiesForPatient(patient.id)
  const therapies = getTherapiesForPatient(patient.id)
  const deviceIntegrations = getIntegrationsForPatient(patient.id)
  const screenings = getScreeningsForPatient(patient.id)
  const procamResults = getProcamForPatient(patient.id)
  const digitalLinks = getDigitalLinksForPatient(patient.id)

  const latestAnthro = anthroEntries.length > 0 ? anthroEntries[anthroEntries.length - 1] : null
  const selectedLabParameter = LAB_PARAMETERS.find((param) => param.id === labParameterId)
  const entriesForSelectedLab = labEntries.filter((entry) => entry.parameterId === labParameterId)
  const creatinineClearanceParam = LAB_PARAMETERS.find((param) => param.id === "lab_creatinine_clearance")
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
  const derivedAllergens = useMemo(() => {
    const result: string[] = []
    const indication = patient.indication?.toLowerCase() ?? ""
    if (indication.includes("zöliakie") || indication.includes("gluten")) result.push("gluten")
    if (indication.includes("laktose")) result.push("lactose")
    if (indication.includes("allerg")) result.push("nuts")
    return Array.from(new Set(result))
  }, [patient.indication])

  const creatinineClearance = useMemo(() => {
    if (!latestAnthro) return null
    const serum = parseFloat(creatinineInput)
    if (Number.isNaN(serum) || serum <= 0) return null
    const referenceWeight = correctedWeight ?? latestAnthro.weight
    let clearance = ((140 - ageYears) * referenceWeight) / (72 * serum)
    if (patient.gender === "w") clearance *= 0.85
    return Math.round(clearance)
  }, [ageYears, correctedWeight, creatinineInput, latestAnthro, patient.gender])

  const creatinineStage = useMemo(() => {
    if (!creatinineClearance) return null
    if (creatinineClearance >= 90) return "Normal"
    if (creatinineClearance >= 60) return "G2"
    if (creatinineClearance >= 30) return "G3"
    if (creatinineClearance >= 15) return "G4"
    return "G5"
  }, [creatinineClearance])

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

  const therapyModuleLabels: Record<string, string> = {
    diabetes: "Diabetes-Modul",
    ketogen: "Ketogene Therapie",
    allergen: "Allergenmanagement",
    intoleranz: "Intoleranzen",
  }


  const mnaScore = useMemo(
    () => Object.values(mnaInputs).reduce((sum, value) => sum + value, 0),
    [mnaInputs],
  )
  const mnaClassification = mnaScore >= 24 ? "Normal" : mnaScore >= 17 ? "Risiko" : "Mangelernährt"
  const mnaRiskLevel: "low" | "medium" | "high" =
    mnaClassification === "Normal" ? "low" : mnaClassification === "Risiko" ? "medium" : "high"

  const sgaScore = useMemo(() => {
    return Object.entries(sgaInputs).reduce((sum, [questionId, selection]) => {
      const question = SGA_QUESTIONS.find((item) => item.id === questionId)
      const option = question?.options.find((item) => item.id === selection)
      return sum + (option?.score ?? 0)
    }, 0)
  }, [sgaInputs])

  const sgaClassification = sgaScore <= 3 ? "A" : sgaScore <= 6 ? "B" : "C"
  const sgaRiskLevel: "low" | "medium" | "high" =
    sgaClassification === "A" ? "low" : sgaClassification === "B" ? "medium" : "high"

  const protocolComparison = useMemo(() => protocols.slice(0, 2), [protocols])
  const comparisonMetrics = [
    { key: "energie", label: "Energie", unit: "kcal" },
    { key: "eiweiss", label: "Eiweiß", unit: "g" },
    { key: "fett", label: "Fett", unit: "g" },
    { key: "kohlenhydrate", label: "Kohlenhydrate", unit: "g" },
  ]

  const procamPreviewScore = useMemo(() => {
    const base = procamForm.ldl / 3 + (procamForm.systolic - 100)
    const smokerBonus = procamForm.smoker ? 15 : 0
    const hdlFactor = procamForm.hdl ? procamForm.hdl / 8 : 0
    const ageFactor = (procamForm.age - 35) * 0.8
    return Math.max(10, Math.round(base + smokerBonus - hdlFactor + ageFactor))
  }, [procamForm])

  const procamCategory = procamPreviewScore >= 60 ? "high" : procamPreviewScore >= 40 ? "moderate" : "low"

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

  const handleSaveClearance = () => {
    if (!creatinineClearance || !creatinineClearanceParam) {
      toast.error("Bitte Clearance berechnen")
      return
    }
    addLabValue({
      patientId: patient.id,
      parameterId: creatinineClearanceParam.id,
      value: creatinineClearance,
      date: new Date().toISOString().slice(0, 10),
      notes: "Cockcroft-Gault Rechner",
    })
    toast.success("Clearance im Laborpanel gespeichert")
  }

  const handleIntegrationSync = (integrationId: string) => {
    updateIntegration(integrationId, {
      status: "connected",
      lastSync: new Date().toISOString(),
    })
    toast.success("Gerät synchronisiert")
  }

  const handleAddIntegration = (type: "cgm" | "pump" | "allergen") => {
    const newEntry = addIntegration({
      patientId: patient.id,
      type,
      status: "pending",
      vendor: type === "cgm" ? "LibreLink" : type === "pump" ? "Ypsomed" : "Allergen Cloud",
    })
    toast.message("Integration gestartet", {
      description: `${newEntry.vendor} für ${type.toUpperCase()} vorbereitet`,
    })
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

  const handleScreeningSubmit = (tool: "MUST" | "NRS-2002", score: number) => {
    const riskLevel = score >= 3 ? "high" : score === 2 ? "medium" : "low"
    addScreening({
      patientId: patient.id,
      tool,
      score,
      riskLevel,
      answers: [],
    })
  }

  const handleSaveMna = () => {
    if (!mnaScore) {
      toast.error("Bitte alle relevanten Fragen beantworten")
      return
    }
    addScreening({
      patientId: patient.id,
      tool: "MNA",
      score: mnaScore,
      riskLevel: mnaRiskLevel,
      answers: MNA_QUESTIONS.map((question) => {
        const option = question.options.find((opt) => opt.value === mnaInputs[question.id])
        return { question: question.label, answer: option ? option.label : "–" }
      }),
    })
    toast.success("MNA-Ergebnis gespeichert")
  }

  const handleSaveSga = () => {
    if (!Object.keys(sgaInputs).length) {
      toast.error("Bitte alle SGA-Kriterien erfassen")
      return
    }
    addScreening({
      patientId: patient.id,
      tool: "SGA",
      score: sgaScore,
      riskLevel: sgaRiskLevel,
      answers: SGA_QUESTIONS.map((question) => {
        const option = question.options.find((opt) => opt.id === sgaInputs[question.id])
        return { question: question.label, answer: option ? option.label : "–" }
      }),
    })
    toast.success("SGA-Dokumentation gespeichert")
  }

  const handleProcamSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    addProcam({
      patientId: patient.id,
      score: procamPreviewScore,
      category: procamCategory,
      age: procamForm.age,
      ldl: procamForm.ldl,
      hdl: procamForm.hdl,
      systolic: procamForm.systolic,
      smoker: procamForm.smoker,
    })
  }

  return (
    <Tabs defaultValue="stammdaten">
      <TabsList>
        <TabsTrigger value="stammdaten">Stammdaten</TabsTrigger>
        <TabsTrigger value="anthropometrie">Anthropometrie</TabsTrigger>
        <TabsTrigger value="diagnosen">Diagnosen & Medikamente</TabsTrigger>
        <TabsTrigger value="laborwerte">Laborwerte</TabsTrigger>
        <TabsTrigger value="aktivitaet">Aktivität & Energie</TabsTrigger>
        <TabsTrigger value="therapien">Therapien</TabsTrigger>
        <TabsTrigger value="protokolle">Protokolle</TabsTrigger>
        <TabsTrigger value="beratungen">Beratungen</TabsTrigger>
      </TabsList>

      <TabsContent value="stammdaten" className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Persönliche Daten</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-3 sm:grid-cols-2">
              <div>
                <dt className="text-sm text-muted-foreground">Geburtsdatum</dt>
                <dd className="text-sm font-medium">{formatDate(patient.dateOfBirth)}</dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">Geschlecht</dt>
                <dd className="text-sm font-medium">
                  {patient.gender === "m" ? "Männlich" : patient.gender === "w" ? "Weiblich" : "Divers"}
                </dd>
              </div>
              {patient.email && (
                <div>
                  <dt className="text-sm text-muted-foreground">E-Mail</dt>
                  <dd className="text-sm font-medium">{patient.email}</dd>
                </div>
              )}
              {patient.phone && (
                <div>
                  <dt className="text-sm text-muted-foreground">Telefon</dt>
                  <dd className="text-sm font-medium">{patient.phone}</dd>
                </div>
              )}
              {patient.street && (
                <div className="sm:col-span-2">
                  <dt className="text-sm text-muted-foreground">Adresse</dt>
                  <dd className="text-sm font-medium">
                    {patient.street}, {patient.zip} {patient.city}
                  </dd>
                </div>
              )}
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Versicherung & Medizinisches</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-3 sm:grid-cols-2">
              {patient.insuranceProvider && (
                <div>
                  <dt className="text-sm text-muted-foreground">Krankenkasse</dt>
                  <dd className="text-sm font-medium">{patient.insuranceProvider}</dd>
                </div>
              )}
              {patient.insuranceNumber && (
                <div>
                  <dt className="text-sm text-muted-foreground">Versichertennummer</dt>
                  <dd className="text-sm font-medium">{patient.insuranceNumber}</dd>
                </div>
              )}
              {patient.indication && (
                <div>
                  <dt className="text-sm text-muted-foreground">Indikation</dt>
                  <dd className="text-sm font-medium">
                    <Badge variant="secondary">{patient.indication}</Badge>
                  </dd>
                </div>
              )}
              {amputationDescriptions.length > 0 && (
                <div className="sm:col-span-2">
                  <dt className="text-sm text-muted-foreground">Amputationen</dt>
                  <dd className="mt-1 flex flex-wrap gap-2">
                    {amputationDescriptions.map((label) => (
                      <Badge key={label} variant="outline">
                        {label.replace(/\s*\([^)]*\)/, "")}
                      </Badge>
                    ))}
                  </dd>
                  <p className="text-xs text-muted-foreground">
                    BMI-Korrektur: {(amputationFactor * 100).toFixed(1)} %
                  </p>
                </div>
              )}
            </dl>
            {patient.notes && (
              <div className="mt-4">
                <dt className="text-sm text-muted-foreground">Notizen</dt>
                <dd className="mt-1 text-sm whitespace-pre-wrap">{patient.notes}</dd>
              </div>
            )}
          </CardContent>
        </Card>

        {latestAnthro && (
          <Card>
            <CardHeader>
              <CardTitle>Aktuelle Messwerte</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-3 sm:grid-cols-4">
                <div>
                  <dt className="text-sm text-muted-foreground">Gewicht</dt>
                  <dd className="text-lg font-semibold">
                    {formatNumber(latestAnthro.weight, 1)} kg
                  </dd>
                  {hasAmputation && correctedWeight && (
                    <p className="text-xs text-muted-foreground">
                      Korrigiert: {formatNumber(correctedWeight, 1)} kg
                    </p>
                  )}
                </div>
                <div>
                  <dt className="text-sm text-muted-foreground">Größe</dt>
                  <dd className="text-lg font-semibold">{formatNumber(latestAnthro.height, 0)} cm</dd>
                </div>
                <div>
                  <dt className="text-sm text-muted-foreground">BMI</dt>
                  <dd className="text-lg font-semibold">
                    {formatNumber(correctedBmi ?? latestAnthro.bmi, 1)}
                  </dd>
                  {hasAmputation && (
                    <p className="text-xs text-muted-foreground">
                      Gemessen: {formatNumber(latestAnthro.bmi, 1)}
                    </p>
                  )}
                </div>
                <div>
                  <dt className="text-sm text-muted-foreground">Datum</dt>
                  <dd className="text-lg font-semibold">{formatDate(latestAnthro.date)}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>
        )}
      </TabsContent>

      <TabsContent value="anthropometrie" className="space-y-4">
        {chartEntries.length > 1 && (
          <AnthropometricChart entries={chartEntries} />
        )}

        {isPediatric && anthroEntries.length > 0 && (
          <PediatricPercentileChart
            entries={anthroEntries}
            gender={patient.gender}
            birthDate={patient.dateOfBirth}
          />
        )}

        {latestAnthro && (
          <Card>
            <CardHeader>
              <CardTitle>Anthropometrie-Insights</CardTitle>
              <CardDescription>Korrekturen, Perzentile und Trendanalyse.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              <div>
                <p className="text-xs uppercase text-muted-foreground">BMI (korrigiert)</p>
                <p className="text-2xl font-semibold">
                  {formatNumber(correctedBmi ?? latestAnthro.bmi, 1)}
                </p>
                {hasAmputation ? (
                  <p className="text-xs text-muted-foreground">
                    Faktor {(amputationFactor * 100).toFixed(1)} % · {amputationDescriptions.join(", ")}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">Keine Korrektur notwendig</p>
                )}
              </div>
              <div>
                <p className="text-xs uppercase text-muted-foreground">Perzentil</p>
                {bmiPercentile ? (
                  <div>
                    <p className="text-2xl font-semibold">{bmiPercentile.bracket}</p>
                    <p className="text-xs text-muted-foreground">
                      BMI {formatNumber(bmiPercentile.bmi, 1)} bei {bmiPercentile.refAgeYears.toFixed(1)} Jahren Referenz
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Nur für Patienten &lt; 18 Jahre verfügbar.</p>
                )}
              </div>
              <div>
                <p className="text-xs uppercase text-muted-foreground">Trend</p>
                {weightTrend ? (
                  <div>
                    <p className="text-2xl font-semibold">
                      {weightTrend.perWeek > 0 ? "+" : ""}
                      {formatNumber(weightTrend.perWeek, 1)} kg/Woche
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Gesamt: {weightTrend.totalChange > 0 ? "+" : ""}
                      {formatNumber(weightTrend.totalChange, 1)} kg · seit {formatDate(weightTrend.startDate)}
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Trend wird berechnet, sobald mindestens zwei Messungen vorliegen.</p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {latestAnthro && (
          <Card>
            <CardHeader>
              <CardTitle>Zielgewicht & Projektion</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <Label htmlFor="target-weight">Zielgewicht (kg)</Label>
                  <Input
                    id="target-weight"
                    type="number"
                    step="0.1"
                    value={targetWeightInput}
                    onChange={(event) => setTargetWeightInput(event.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="calorie-deficit">Kaloriendefizit / Tag</Label>
                  <Input
                    id="calorie-deficit"
                    type="number"
                    value={calorieDeficitInput}
                    onChange={(event) => setCalorieDeficitInput(event.target.value)}
                  />
                </div>
                <div>
                  <Label>Zielerreichung</Label>
                  <Progress value={weightProgressPercent} className="mt-2" />
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatNumber(weightProgressPercent, 0)} % des Weges geschafft
                  </p>
                </div>
              </div>
              {weightProjection && (
                <div className="rounded-md border bg-muted/40 p-3 text-sm">
                  {weightProjection.finished ? (
                    <p>Zielgewicht bereits erreicht. Weiterer Fokus: Stabilisierung.</p>
                  ) : (
                    <p>
                      Prognose: Zielgewicht am {formatDate(weightProjection.finishDate)} (ca. {weightProjection.days}{" "}
                      Tage)
                    </p>
                  )}
                  {weightTrend && (
                    <p className="text-xs text-muted-foreground">
                      Aktueller Trend: {weightTrend.perWeek > 0 ? "+" : ""}
                      {formatNumber(weightTrend.perWeek, 1)} kg/Woche
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Messwerte</CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAnthroForm(!showAnthroForm)}
            >
              <Plus className="mr-2 h-4 w-4" />
              Neue Messung
            </Button>
          </CardHeader>
          <CardContent>
            {showAnthroForm && (
              <div className="mb-6 rounded-lg border p-4">
                <AnthropometricForm
                  patientId={patient.id}
                  defaultHeight={latestAnthro?.height}
                  onSubmit={(entry) => {
                    addAnthroEntry(entry)
                    setShowAnthroForm(false)
                  }}
                  onCancel={() => setShowAnthroForm(false)}
                />
              </div>
            )}

            {anthroEntries.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Datum</TableHead>
                    <TableHead className="text-right">Gewicht (kg)</TableHead>
                    <TableHead className="text-right">Größe (cm)</TableHead>
                    <TableHead className="text-right">BMI</TableHead>
                    <TableHead className="text-right">Bauchumfang (cm)</TableHead>
                    <TableHead className="text-right">Körperfett (%)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...anthroEntries].reverse().map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell>{formatDate(entry.date)}</TableCell>
                      <TableCell className="text-right">{formatNumber(entry.weight, 1)}</TableCell>
                      <TableCell className="text-right">{formatNumber(entry.height, 0)}</TableCell>
                      <TableCell className="text-right">
                        {formatNumber(getCorrectedBmi(entry), 1)}
                        {hasAmputation && (
                          <span className="block text-[11px] text-muted-foreground">
                            Messung: {formatNumber(entry.bmi, 1)}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {entry.waistCircumference ? formatNumber(entry.waistCircumference, 0) : "–"}
                      </TableCell>
                      <TableCell className="text-right">
                        {entry.bodyFatPercentage ? formatNumber(entry.bodyFatPercentage, 1) : "–"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                Noch keine Messwerte vorhanden.
              </p>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="diagnosen" className="space-y-4">
        <Card>
          <CardHeader className="flex flex-row items-start justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Stethoscope className="h-4 w-4" /> Diagnosen
              </CardTitle>
              <CardDescription>Chronische Diagnosen, ICD-Codes und Anmerkungen.</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => setShowDiagnosisForm((prev) => !prev)}>
              {showDiagnosisForm ? "Abbrechen" : "Diagnose erfassen"}
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {showDiagnosisForm && (
              <form className="grid gap-3 md:grid-cols-2" onSubmit={handleDiagnosisSubmit}>
                <div className="md:col-span-2">
                  <Label htmlFor="diagnosis-name">Diagnose</Label>
                  <Input
                    id="diagnosis-name"
                    value={diagnosisForm.diagnosis}
                    onChange={(event) => setDiagnosisForm((prev) => ({ ...prev, diagnosis: event.target.value }))}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="diagnosis-icd">ICD-Code</Label>
                  <Input
                    id="diagnosis-icd"
                    value={diagnosisForm.icdCode}
                    onChange={(event) => setDiagnosisForm((prev) => ({ ...prev, icdCode: event.target.value }))}
                    placeholder="z. B. E11.9"
                  />
                </div>
                <div>
                  <Label htmlFor="diagnosis-start">Beginn</Label>
                  <Input
                    type="date"
                    id="diagnosis-start"
                    value={diagnosisForm.startDate}
                    onChange={(event) => setDiagnosisForm((prev) => ({ ...prev, startDate: event.target.value }))}
                  />
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="diagnosis-notes">Notizen</Label>
                  <Textarea
                    id="diagnosis-notes"
                    rows={3}
                    value={diagnosisForm.notes}
                    onChange={(event) => setDiagnosisForm((prev) => ({ ...prev, notes: event.target.value }))}
                  />
                </div>
                <div className="md:col-span-2 flex items-center justify-end gap-2">
                  <Button type="button" variant="ghost" onClick={() => setShowDiagnosisForm(false)}>
                    Abbrechen
                  </Button>
                  <Button type="submit">Speichern</Button>
                </div>
              </form>
            )}
            {diagnoses.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Diagnose</TableHead>
                    <TableHead>ICD</TableHead>
                    <TableHead>Start</TableHead>
                    <TableHead>Notizen</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {diagnoses.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="font-medium">{entry.diagnosis}</TableCell>
                      <TableCell>{entry.icdCode ?? "–"}</TableCell>
                      <TableCell>{formatDate(entry.startDate)}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {entry.notes ? entry.notes.slice(0, 64) : "–"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-sm text-muted-foreground">Noch keine Diagnosen hinterlegt.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-start justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Pill className="h-4 w-4" /> Medikamente
              </CardTitle>
              <CardDescription>Dosierungen, Einnahmeschemata und Gründe.</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => setShowMedicationForm((prev) => !prev)}>
              {showMedicationForm ? "Abbrechen" : "Medikation erfassen"}
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {showMedicationForm && (
              <form className="grid gap-3 md:grid-cols-2" onSubmit={handleMedicationSubmit}>
                <div>
                  <Label htmlFor="med-name">Name</Label>
                  <Input
                    id="med-name"
                    value={medicationForm.name}
                    onChange={(event) => setMedicationForm((prev) => ({ ...prev, name: event.target.value }))}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="med-dosage">Dosierung</Label>
                  <Input
                    id="med-dosage"
                    placeholder="1000 mg"
                    value={medicationForm.dosage}
                    onChange={(event) => setMedicationForm((prev) => ({ ...prev, dosage: event.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="med-schedule">Schema</Label>
                  <Input
                    id="med-schedule"
                    placeholder="2× täglich"
                    value={medicationForm.schedule}
                    onChange={(event) => setMedicationForm((prev) => ({ ...prev, schedule: event.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="med-start">Startdatum</Label>
                  <Input
                    type="date"
                    id="med-start"
                    value={medicationForm.startDate}
                    onChange={(event) => setMedicationForm((prev) => ({ ...prev, startDate: event.target.value }))}
                  />
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="med-reason">Grund</Label>
                  <Textarea
                    id="med-reason"
                    rows={2}
                    value={medicationForm.reason}
                    onChange={(event) => setMedicationForm((prev) => ({ ...prev, reason: event.target.value }))}
                  />
                </div>
                <div className="md:col-span-2 flex items-center justify-end gap-2">
                  <Button type="button" variant="ghost" onClick={() => setShowMedicationForm(false)}>
                    Abbrechen
                  </Button>
                  <Button type="submit">Speichern</Button>
                </div>
              </form>
            )}
            {medications.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Medikament</TableHead>
                    <TableHead>Dosierung</TableHead>
                    <TableHead>Schema</TableHead>
                    <TableHead>Start</TableHead>
                    <TableHead>Hinweis</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {medications.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="font-medium">{entry.name}</TableCell>
                      <TableCell>{entry.dosage}</TableCell>
                      <TableCell>{entry.schedule}</TableCell>
                      <TableCell>{formatDate(entry.startDate)}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {entry.reason ?? entry.notes ?? "–"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-sm text-muted-foreground">Keine Medikamente dokumentiert.</p>
            )}
            {medications.length > 0 && (
              <div>
                <p className="mt-4 text-xs uppercase text-muted-foreground">Einnahmehistorie</p>
                <div className="mt-2 space-y-2">
                  {[...medications]
                    .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime())
                    .map((entry) => (
                      <div key={`med_timeline_${entry.id}`} className="rounded-md border p-3 text-sm">
                        <p className="font-medium">{entry.name}</p>
                        <p className="text-xs text-muted-foreground">
                          seit {formatDate(entry.startDate)} · {entry.dosage || "k.A."} · {entry.schedule || "Schema offen"}
                        </p>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="laborwerte" className="space-y-4">
        <Card>
          <CardHeader className="flex flex-row items-start justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FlaskConical className="h-4 w-4" /> Laborpanel
              </CardTitle>
              <CardDescription>
                {selectedLabParameter?.description ?? "Parameter wählen und neue Messung erfassen."}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <form className="grid gap-3 md:grid-cols-4" onSubmit={handleLabSubmit}>
              <div className="md:col-span-2">
                <Label>Parameter</Label>
                <Select value={labParameterId} onValueChange={setLabParameterId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Parameter wählen" />
                  </SelectTrigger>
                  <SelectContent>
                    {LAB_PARAMETERS.map((param) => (
                      <SelectItem key={param.id} value={param.id}>
                        {param.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>
                  Wert {selectedLabParameter ? `(${selectedLabParameter.unit})` : ""}
                </Label>
                <Input
                  value={labValueInput}
                  onChange={(event) => setLabValueInput(event.target.value)}
                  required
                  placeholder="z. B. 5.6"
                />
              </div>
              <div>
                <Label>Datum</Label>
                <Input
                  type="date"
                  value={labDateInput}
                  onChange={(event) => setLabDateInput(event.target.value)}
                />
              </div>
              <div className="md:col-span-4">
                <Label>Notiz</Label>
                <Textarea
                  rows={2}
                  value={labNotesInput}
                  onChange={(event) => setLabNotesInput(event.target.value)}
                  placeholder="z. B. nüchtern, Labor Praxis X"
                />
              </div>
              <div className="md:col-span-4 flex flex-wrap justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    if (!selectedLabParameter || entriesForSelectedLab.length === 0) {
                      toast.error("Keine Messungen für Export vorhanden")
                      return
                    }
                    const rows = [
                      ["Datum", "Wert", "Einheit", "Notiz"],
                      ...entriesForSelectedLab.map((entry) => [
                        formatDate(entry.date),
                        entry.value.toString(),
                        selectedLabParameter.unit,
                        entry.notes ?? "",
                      ]),
                    ]
                    downloadCsv(`${patient.lastName}_${selectedLabParameter.shortName}`, rows)
                    toast.success("CSV exportiert")
                  }}
                >
                  CSV Export
                </Button>
                <Button type="submit">Messung speichern</Button>
              </div>
            </form>

            {selectedLabParameter && (
              <div className="rounded-lg border p-3 text-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold">{selectedLabParameter.name}</p>
                    <p className="text-muted-foreground text-xs">
                      Referenz {selectedLabParameter.referenceMin}–{selectedLabParameter.referenceMax}{' '}
                      {selectedLabParameter.unit}
                    </p>
                  </div>
                  {entriesForSelectedLab.length > 0 && (
                    <Badge
                      variant="outline"
                      className={
                        complianceBadge(
                          entriesForSelectedLab[entriesForSelectedLab.length - 1].value,
                          selectedLabParameter.referenceMin,
                          selectedLabParameter.referenceMax,
                        ) === "ok"
                          ? "border-emerald-200 text-emerald-700"
                          : "border-amber-200 text-amber-700"
                      }
                    >
                      {entriesForSelectedLab[entriesForSelectedLab.length - 1].value}
                      {selectedLabParameter.unit}
                    </Badge>
                  )}
                </div>
                <div className="mt-3 flex items-end gap-1">
                  {entriesForSelectedLab.slice(-16).map((entry) => {
                    const percent = selectedLabParameter.referenceMax
                      ? Math.min(100, (entry.value / selectedLabParameter.referenceMax) * 100)
                      : 0
                    return (
                      <span
                        key={entry.id}
                        className="w-2 rounded-full bg-primary/60"
                        style={{ height: `${Math.max(15, percent)}px` }}
                        title={`${formatDate(entry.date)} · ${entry.value} ${selectedLabParameter.unit}`}
                      />
                    )
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Verlauf</CardTitle>
            <CardDescription>Chronologische Auflistung für den gewählten Parameter.</CardDescription>
          </CardHeader>
          <CardContent>
            {entriesForSelectedLab.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Datum</TableHead>
                    <TableHead>Wert</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Notiz</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...entriesForSelectedLab].reverse().map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell>{formatDate(entry.date)}</TableCell>
                      <TableCell>
                        {entry.value} {selectedLabParameter?.unit}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            selectedLabParameter &&
                            complianceBadge(
                              entry.value,
                              selectedLabParameter.referenceMin,
                              selectedLabParameter.referenceMax,
                            ) !== "ok"
                              ? "border-amber-200 text-amber-700"
                              : "border-emerald-200 text-emerald-700"
                          }
                        >
                          {selectedLabParameter
                            ? complianceBadge(
                                entry.value,
                                selectedLabParameter.referenceMin,
                                selectedLabParameter.referenceMax,
                              ) === "ok"
                                ? "im Referenzbereich"
                                : "außerhalb"
                            : "–"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {entry.notes ?? "–"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-sm text-muted-foreground">Noch keine Werte dokumentiert.</p>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="aktivitaet" className="space-y-4">
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ActivityIcon className="h-4 w-4" /> Energie & PAL
              </CardTitle>
              <CardDescription>WHO-BMR mit PAL-Szenario für Tagesbedarf.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Grundumsatz</p>
                  <p className="text-2xl font-semibold">{basalMetabolicRate} kcal</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Gesamtumsatz</p>
                  <p className="text-2xl font-semibold">{totalEnergyExpenditure} kcal</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Aktivität (Log)</p>
                  <p className="text-2xl font-semibold">{activityKcal} kcal</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">PAL-Faktor</p>
                  <p className="text-2xl font-semibold">{palValue}</p>
                </div>
              </div>
              <div className="space-y-2">
                <Label>PAL auswählen</Label>
                <Select value={palValue} onValueChange={setPalValue}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {palOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <p className="text-xs uppercase text-muted-foreground">Progress zur Empfehlung</p>
                <Progress value={Math.min(100, (totalEnergyExpenditure / 2600) * 100)} className="mt-2" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Aktivitätsprotokoll</CardTitle>
                <CardDescription>Tägliche Bewegungen & Bewegungstypen.</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <form className="grid gap-3 md:grid-cols-4" onSubmit={handleActivitySubmit}>
                <div className="md:col-span-2">
                  <Label>Aktivität</Label>
                  <Input
                    value={activityForm.type}
                    onChange={(event) => setActivityForm((prev) => ({ ...prev, type: event.target.value }))}
                    placeholder="Spaziergang"
                    required
                  />
                </div>
                <div>
                  <Label>Dauer (Minuten)</Label>
                  <Input
                    type="number"
                    min={5}
                    value={activityForm.durationMinutes}
                    onChange={(event) => setActivityForm((prev) => ({ ...prev, durationMinutes: event.target.value }))}
                    required
                  />
                </div>
                <div>
                  <Label>Datum</Label>
                  <Input
                    type="date"
                    value={activityForm.date}
                    onChange={(event) => setActivityForm((prev) => ({ ...prev, date: event.target.value }))}
                  />
                </div>
                <div className="md:col-span-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="activity-intensity" className="text-xs text-muted-foreground">
                      Intensität
                    </Label>
                    <Select
                      value={activityForm.intensity}
                      onValueChange={(value) => setActivityForm((prev) => ({ ...prev, intensity: value }))}
                    >
                      <SelectTrigger className="w-[140px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="leicht">Leicht</SelectItem>
                        <SelectItem value="moderat">Moderat</SelectItem>
                        <SelectItem value="intensiv">Intensiv</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button type="submit">Aktivität speichern</Button>
                </div>
              </form>
              <div className="flex flex-wrap gap-2">
                {activities.length > 0 ? (
                  activities.map((entry) => (
                    <Badge key={entry.id} variant="secondary" className="flex items-center gap-1">
                      {entry.type}
                      <span className="text-muted-foreground text-[11px]">
                        {formatDate(entry.date)} · {entry.durationMinutes} min
                      </span>
                    </Badge>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">Keine Aktivitäten erfasst.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </TabsContent>

      <TabsContent value="therapien" className="space-y-4">
        <Card>
          <CardHeader className="flex flex-row items-start justify-between">
            <div>
              <CardTitle>Therapiemodule</CardTitle>
              <CardDescription>Module aktivieren und Zielwerte pflegen.</CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                upsertSetting({
                  id: `therapy_${Date.now()}`,
                  patientId: patient.id,
                  module: "diabetes",
                  status: "active",
                  targets: { beProMeal: "4", glucoseFasting: "90-120 mg/dl" },
                })
              }
            >
              Modul hinzufügen
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {therapies.length > 0 ? (
              therapies.map((therapy) => (
                <div
                  key={therapy.id}
                  className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-semibold">{therapyModuleLabels[therapy.module] ?? therapy.module}</p>
                    <p className="text-muted-foreground text-sm">
                      Zielwerte:{' '}
                      {therapy.targets
                        ? Object.entries(therapy.targets)
                            .map(([key, value]) => `${key}: ${value}`)
                            .join(", ")
                        : "–"}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={therapy.status === "active" ? "secondary" : "outline"}>
                      {therapy.status === "active" ? "Aktiv" : "Pausiert"}
                    </Badge>
                    <Switch
                      checked={therapy.status === "active"}
                      onCheckedChange={(checked) =>
                        upsertSetting({
                          ...therapy,
                          status: checked ? "active" : "paused",
                        })
                      }
                    />
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">Noch keine Therapieparameter gepflegt.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-start justify-between">
            <div>
              <CardTitle>Geräte & Automationen</CardTitle>
              <CardDescription>Live-Sync für CGM, Pumpen und Allergenfilter.</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => handleAddIntegration("cgm")}>
                CGM koppeln
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleAddIntegration("allergen")}>
                Allergen-Link
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {deviceIntegrations.length > 0 ? (
              deviceIntegrations.map((integration) => (
                <div
                  key={integration.id}
                  className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-semibold">{integration.vendor}</p>
                    <p className="text-xs text-muted-foreground">
                      {integration.type.toUpperCase()} · {integration.lastSync ? `Letzter Sync ${formatDate(integration.lastSync)}` : "noch nicht synchronisiert"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={
                        integration.status === "connected"
                          ? "secondary"
                          : integration.status === "pending"
                            ? "outline"
                            : "destructive"
                      }
                    >
                      {integration.status === "connected"
                        ? "Verbunden"
                        : integration.status === "pending"
                          ? "Wartet"
                          : "Fehler"}
                    </Badge>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => handleIntegrationSync(integration.id)}
                    >
                      Sync anstoßen
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">Keine Integrationen hinterlegt.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Mangelernährungs-Screening</CardTitle>
            <CardDescription>MUST & NRS-2002 Bewertung und Dokumentation.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-lg border p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold">MUST</p>
                    <p className="text-xs text-muted-foreground">Malnutrition Universal Screening Tool</p>
                  </div>
                  <Badge variant="outline">Score {mustScore}</Badge>
                </div>
                <div className="mt-3 space-y-2">
                  <Label>Score</Label>
                  <Input
                    type="number"
                    min={0}
                    max={5}
                    value={mustScore}
                    onChange={(event) => setMustScore(Number(event.target.value))}
                  />
                  <Button type="button" size="sm" className="w-full" onClick={() => handleScreeningSubmit("MUST", mustScore)}>
                    Ergebnis speichern
                  </Button>
                </div>
              </div>

              <div className="rounded-lg border p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold">NRS-2002</p>
                    <p className="text-xs text-muted-foreground">Nutrition Risk Screening</p>
                  </div>
                  <Badge variant="outline">Score {nrsScore}</Badge>
                </div>
                <div className="mt-3 space-y-2">
                  <Label>Score</Label>
                  <Input
                    type="number"
                    min={0}
                    max={7}
                    value={nrsScore}
                    onChange={(event) => setNrsScore(Number(event.target.value))}
                  />
                  <Button type="button" size="sm" className="w-full" onClick={() => handleScreeningSubmit("NRS-2002", nrsScore)}>
                    Ergebnis speichern
                  </Button>
                </div>
              </div>
            </div>
            <div>
              <p className="text-xs uppercase text-muted-foreground">Historie</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {screenings.length > 0 ? (
                  screenings.map((result) => (
                    <Badge key={result.id} variant="secondary" className="flex items-center gap-1">
                      {result.tool} · Score {result.score}
                      <span className="text-[11px] text-muted-foreground">{formatDate(result.updatedAt)}</span>
                    </Badge>
                  ))
                ) : (
                  <span className="text-sm text-muted-foreground">Noch keine Einträge.</span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Medizinische Rechner</CardTitle>
            <CardDescription>Creatinin-Clearance, MNA und SGA im Schnellzugriff.</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={calculatorTab} onValueChange={setCalculatorTab}>
              <TabsList className="mb-4 grid w-full grid-cols-3">
                <TabsTrigger value="creatinine">Kreatinin</TabsTrigger>
                <TabsTrigger value="mna">MNA</TabsTrigger>
                <TabsTrigger value="sga">SGA</TabsTrigger>
              </TabsList>
              <TabsContent value="creatinine" className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label htmlFor="creatinine-value">Serum-Kreatinin (mg/dl)</Label>
                    <Input
                      id="creatinine-value"
                      type="number"
                      step="0.1"
                      value={creatinineInput}
                      onChange={(event) => setCreatinineInput(event.target.value)}
                    />
                    <p className="mt-2 text-xs text-muted-foreground">
                      Cockcroft-Gault-Formel: ((140 - Alter) × Gewicht) / (72 × Kreatinin)
                    </p>
                  </div>
                  <div className="rounded-lg border bg-muted/40 p-4">
                    <p className="text-xs uppercase text-muted-foreground">Kreatinin-Clearance</p>
                    <p className="text-3xl font-semibold">
                      {creatinineClearance ? `${creatinineClearance} ml/min` : "–"}
                    </p>
                    {creatinineStage && (
                      <Badge className="mt-2 w-fit" variant="secondary">
                        Stadium {creatinineStage}
                      </Badge>
                    )}
                    <p className="mt-1 text-xs text-muted-foreground">
                      Referenzgewicht: {formatNumber((correctedWeight ?? latestAnthro?.weight) ?? 0, 1)} kg
                    </p>
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button type="button" variant="outline" disabled={!creatinineClearance} onClick={handleSaveClearance}>
                    In Laborwerte übernehmen
                  </Button>
                </div>
              </TabsContent>
              <TabsContent value="mna" className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  {MNA_QUESTIONS.map((question) => (
                    <div key={question.id} className="rounded-lg border p-3">
                      <p className="font-semibold text-sm">{question.label}</p>
                      <RadioGroup
                        className="mt-2 space-y-2"
                        value={String(mnaInputs[question.id] ?? "")}
                        onValueChange={(value) =>
                          setMnaInputs((prev) => ({ ...prev, [question.id]: Number(value) }))
                        }
                      >
                        {question.options.map((option) => (
                          <Label
                            key={`${question.id}_${option.value}`}
                            className="flex cursor-pointer items-center gap-2 text-sm font-normal"
                          >
                            <RadioGroupItem value={String(option.value)} />
                            {option.label}
                          </Label>
                        ))}
                      </RadioGroup>
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase text-muted-foreground">Gesamtpunktzahl</p>
                    <p className="text-2xl font-semibold">{mnaScore}</p>
                    <p className="text-sm text-muted-foreground">{mnaClassification}</p>
                  </div>
                  <Button type="button" onClick={handleSaveMna}>
                    MNA speichern
                  </Button>
                </div>
              </TabsContent>
              <TabsContent value="sga" className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  {SGA_QUESTIONS.map((question) => (
                    <div key={question.id} className="rounded-lg border p-3">
                      <p className="font-semibold text-sm">{question.label}</p>
                      <RadioGroup
                        className="mt-2 space-y-2"
                        value={sgaInputs[question.id] ?? ""}
                        onValueChange={(value) =>
                          setSgaInputs((prev) => ({ ...prev, [question.id]: value }))
                        }
                      >
                        {question.options.map((option) => (
                          <Label
                            key={`${question.id}_${option.id}`}
                            className="flex cursor-pointer items-center gap-2 text-sm font-normal"
                          >
                            <RadioGroupItem value={option.id} />
                            {option.label}
                          </Label>
                        ))}
                      </RadioGroup>
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase text-muted-foreground">Gesamtpunktzahl</p>
                    <p className="text-2xl font-semibold">{sgaScore}</p>
                    <p className="text-sm text-muted-foreground">Klasse {sgaClassification}</p>
                  </div>
                  <Button type="button" onClick={handleSaveSga}>
                    SGA speichern
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-start justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <HeartPulse className="h-4 w-4" /> PROCAM Risiko
              </CardTitle>
              <CardDescription>Herz-Kreislauf-Risikoabschätzung.</CardDescription>
            </div>
            <Badge variant={
              procamCategory === "high"
                ? "destructive"
                : procamCategory === "moderate"
                  ? "outline"
                  : "secondary"
            }>
              {procamCategory === "high"
                ? "Hohes Risiko"
                : procamCategory === "moderate"
                  ? "Moderat"
                  : "Niedrig"}
            </Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            <form className="grid gap-3 md:grid-cols-3" onSubmit={handleProcamSubmit}>
              <div>
                <Label>Alter</Label>
                <Input
                  type="number"
                  value={procamForm.age}
                  onChange={(event) => setProcamForm((prev) => ({ ...prev, age: Number(event.target.value) }))}
                />
              </div>
              <div>
                <Label>LDL (mg/dl)</Label>
                <Input
                  type="number"
                  value={procamForm.ldl}
                  onChange={(event) => setProcamForm((prev) => ({ ...prev, ldl: Number(event.target.value) }))}
                />
              </div>
              <div>
                <Label>HDL (mg/dl)</Label>
                <Input
                  type="number"
                  value={procamForm.hdl}
                  onChange={(event) => setProcamForm((prev) => ({ ...prev, hdl: Number(event.target.value) }))}
                />
              </div>
              <div>
                <Label>RR syst.</Label>
                <Input
                  type="number"
                  value={procamForm.systolic}
                  onChange={(event) => setProcamForm((prev) => ({ ...prev, systolic: Number(event.target.value) }))}
                />
              </div>
              <div className="md:col-span-2 flex items-center gap-2">
                <Switch
                  checked={procamForm.smoker}
                  onCheckedChange={(checked) => setProcamForm((prev) => ({ ...prev, smoker: checked }))}
                />
                <Label className="text-sm">Raucherstatus</Label>
              </div>
              <div className="md:col-span-3 flex items-center justify-between rounded-lg border bg-muted/50 p-3">
                <div>
                  <p className="text-xs text-muted-foreground">Prognostizierter Score</p>
                  <p className="text-2xl font-semibold">{procamPreviewScore} Punkte</p>
                </div>
                <Button type="submit">PROCAM speichern</Button>
              </div>
            </form>
            {procamResults.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Datum</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Kategorie</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...procamResults].reverse().map((result) => (
                    <TableRow key={result.id}>
                      <TableCell>{formatDate(result.updatedAt)}</TableCell>
                      <TableCell>{result.score}</TableCell>
                      <TableCell>{result.category}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <DiabetesAnalyticsCard patientName={`${patient.firstName} ${patient.lastName}`} />
        <KetogenicPlannerCard />
        <AllergenAutomationCard initialAllergens={derivedAllergens} />
        <DietCatalogCard />
      </TabsContent>

      <TabsContent value="protokolle" className="space-y-4">
        <div className="flex justify-end">
          <Button asChild>
            <Link href={`/patienten/${patient.id}/protokolle/neu`}>
              <Plus className="mr-2 h-4 w-4" />
              Neues Protokoll
            </Link>
          </Button>
        </div>

        {protocols.length > 0 ? (
          <div className="grid gap-4">
            {protocols.map((protocol) => (
              <Link key={protocol.id} href={`/patienten/${patient.id}/protokolle/${protocol.id}`}>
                <Card className="transition-colors hover:bg-muted/50">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-base">{protocol.title}</CardTitle>
                      <Badge variant="secondary">
                        {PROTOCOL_TYPE_LABELS[protocol.type]}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground">
                    <p>
                      {formatDate(protocol.startDate)} – {formatDate(protocol.endDate)}
                      {" · "}{protocol.days.length} {protocol.days.length === 1 ? "Tag" : "Tage"}
                    </p>
                    {protocol.notes && (
                      <p className="mt-1 line-clamp-1">{protocol.notes}</p>
                    )}
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              Noch keine Ernährungsprotokolle vorhanden.
            </CardContent>
          </Card>
        )}

        <GuidedProtocolAssistant patientId={patient.id} />

        <Card>
          <CardHeader className="flex flex-row items-start justify-between">
            <div>
              <CardTitle>Digitale Protokolle</CardTitle>
              <CardDescription>Links & QR-Codes für Patientenselbst-Erfassung.</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Select value={digitalMethod} onValueChange={setDigitalMethod}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {digitalMethodOptions.map((method) => (
                    <SelectItem key={method} value={method}>
                      {method}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                onClick={() =>
                  generateLink({
                    patientId: patient.id,
                    method: digitalMethod,
                    status: "pending",
                    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
                  })
                }
              >
                Link erstellen
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {digitalLinks.length > 0 ? (
              digitalLinks.map((link) => (
                <div
                  key={link.id}
                  className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-medium">{link.method}</p>
                    <p className="text-muted-foreground text-xs">{link.url}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={link.status === "received" ? "secondary" : link.status === "pending" ? "outline" : "destructive"}
                      className={
                        link.status === "received"
                          ? "border-emerald-200 text-emerald-700"
                          : link.status === "pending"
                            ? "border-amber-200 text-amber-700"
                            : "border-rose-200 text-rose-700"
                      }
                    >
                      {link.status === "received"
                        ? "eingetroffen"
                        : link.status === "pending"
                          ? "ausstehend"
                          : "abgelaufen"}
                    </Badge>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => updateStatus(link.id, link.status === "received" ? "pending" : "received")}
                    >
                      Status toggeln
                    </Button>
                    <Button size="icon" variant="ghost">
                      <QrCode className="h-4 w-4" />
                      <span className="sr-only">QR anzeigen</span>
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">Noch keine digitalen Protokolle generiert.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Protokollvergleich & Compliance</CardTitle>
            <CardDescription>Mock-Vergleich zweier Protokolle inkl. Deckungsgrad.</CardDescription>
          </CardHeader>
          <CardContent>
            {protocolComparison.length >= 2 ? (
              <div className="grid gap-4 md:grid-cols-2">
                {protocolComparison.map((protocol, index) => (
                  <div key={protocol.id} className="rounded-lg border p-3">
                    <p className="font-semibold">{protocol.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {protocol.days.length} Tage · {formatDate(protocol.startDate)}
                    </p>
                    <div className="mt-3 space-y-2">
                      {comparisonMetrics.map((metric, metricIndex) => {
                        const baseScore = Math.min(
                          120,
                          protocol.days.length * 10 + metricIndex * 5 + index * 8,
                        )
                        return (
                          <div key={metric.key}>
                            <div className="flex items-center justify-between text-xs">
                              <span>{metric.label}</span>
                              <span>{baseScore}% Ziel</span>
                            </div>
                            <Progress value={baseScore} className="mt-1" />
                          </div>
                        )
                      })}
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      <span className="text-xs text-muted-foreground">
                        Deckung {Math.min(110, protocol.days.length * 12 + index * 5)}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Mindestens zwei Protokolle erforderlich für den Abgleich.</p>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="beratungen" className="space-y-4">
        <div className="flex justify-end">
          <Button asChild>
            <Link href={`/patienten/${patient.id}/beratungen/neu`}>
              <Plus className="mr-2 h-4 w-4" />
              Neue Beratung
            </Link>
          </Button>
        </div>

        {sessions.length > 0 ? (
          <div className="grid gap-4">
            {sessions
              .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
              .map((session) => (
                <Link
                  key={session.id}
                  href={`/patienten/${patient.id}/beratungen/${session.id}`}
                >
                  <Card className="transition-colors hover:bg-muted/50">
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <CardTitle className="text-base">
                          {session.type} – {session.indication}
                        </CardTitle>
                        <Badge variant="outline">{session.duration} Min.</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="text-sm text-muted-foreground">
                      <p>{formatDate(session.date)}</p>
                      {session.goals && (
                        <p className="mt-1 line-clamp-1">{session.goals}</p>
                      )}
                    </CardContent>
                  </Card>
                </Link>
              ))}
          </div>
        ) : (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              Noch keine Beratungssitzungen vorhanden.
            </CardContent>
          </Card>
        )}
      </TabsContent>
    </Tabs>
  )
}
