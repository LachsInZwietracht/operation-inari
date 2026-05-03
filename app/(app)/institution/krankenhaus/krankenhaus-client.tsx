"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  BedDouble,
  CheckCircle2,
  ChefHat,
  ClipboardList,
  Pencil,
  Plus,
  Printer,
  Truck,
  UserPlus,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { MEAL_SLOT_LABELS } from "@/lib/constants";
import { ALLERGEN_MAP } from "@/lib/allergen-constants";
import { DIET_FORMS } from "@/lib/reference-data/institution";
import {
  buildKitchenSummary,
  buildMealCandidates,
  buildMealOrder,
  getActiveInstitutionMenu,
  getDefaultHospitalDate,
  getHospitalDatesForMenu,
  getSelectedServiceLabel,
  getTrayCardPrintUrl,
} from "@/lib/hospital-workflow";
import { formatDate } from "@/lib/format";
import { writeAccessAuditLog } from "@/lib/audit/access-audit";
import { createClient as createBrowserSupabaseClient } from "@/lib/supabase/client";
import { usePatients } from "@/hooks/use-patients";
import { usePatientAllergens } from "@/hooks/use-patient-allergens";
import { useInpatientStays } from "@/hooks/use-inpatient-stays";
import { useMealOrders } from "@/hooks/use-meal-orders";
import type { InpatientStay, InstitutionMenu, MealCandidate, MealOrder, MealSlotType, Recipe } from "@/lib/types";

const DIET_FORM_MAP = new Map(DIET_FORMS.map((dietForm) => [dietForm.id, dietForm]));

const ORDER_STATUS_CONFIG: Record<MealOrder["status"], { label: string; className: string }> = {
  pending: {
    label: "Ausstehend",
    className: "border-yellow-300 bg-yellow-50 text-yellow-700",
  },
  confirmed: {
    label: "Bestätigt",
    className: "border-blue-300 bg-blue-50 text-blue-700",
  },
  delivered: {
    label: "Ausgeliefert",
    className: "border-green-300 bg-green-50 text-green-700",
  },
  cancelled: {
    label: "Storniert",
    className: "border-gray-300 bg-gray-50 text-gray-600",
  },
};

const MEAL_SLOTS: MealSlotType[] = ["fruehstueck", "mittagessen", "abendessen"];

interface KrankenhausPageClientProps {
  recipes: Recipe[];
  initialMenus: InstitutionMenu[];
}

interface StayFormState {
  patientId: string;
  station: string;
  room: string;
  bed: string;
  admissionDate: string;
  notes: string;
  dietFormIds: string[];
}

function buildStayFormState(stay?: InpatientStay): StayFormState {
  return {
    patientId: stay?.patientId ?? "",
    station: stay?.station ?? "Station 1",
    room: stay?.room ?? "",
    bed: stay?.bed ?? "",
    admissionDate: stay?.admissionDate ?? new Date().toISOString().slice(0, 10),
    notes: stay?.notes ?? "",
    dietFormIds: stay?.dietFormIds ?? ["diet_vollkost"],
  };
}

function getDietBadges(dietFormIds: string[]) {
  return dietFormIds.map((dietFormId) => {
    const form = DIET_FORM_MAP.get(dietFormId);
    return (
      <Badge key={dietFormId} variant="outline">
        {form?.shortName ?? dietFormId}
      </Badge>
    );
  });
}

export function KrankenhausPageClient({ recipes, initialMenus }: KrankenhausPageClientProps) {
  const recipeSource = useMemo(() => {
    const merged = new Map<string, Recipe>();
    for (const recipe of recipes) {
      merged.set(recipe.id, recipe);
      if (recipe.legacyId) {
        merged.set(recipe.legacyId, recipe);
      }
    }
    return Array.from(new Set(merged.values()));
  }, [recipes]);
  const menuSource = initialMenus;
  const { patients } = usePatients();
  const { getForPatient } = usePatientAllergens();
  const { stays, addStay, updateStay, isLoadingRemote: staysLoading } = useInpatientStays();
  const { orders, upsertOrder, updateOrderStatus, isLoadingRemote: ordersLoading } = useMealOrders();

  const activeMenu = useMemo(() => getActiveInstitutionMenu(menuSource), [menuSource]);
  const selectableDates = useMemo(() => getHospitalDatesForMenu(activeMenu), [activeMenu]);
  const [selectedDate, setSelectedDate] = useState(() => getDefaultHospitalDate(menuSource));
  const [selectedMealSlot, setSelectedMealSlot] = useState<MealSlotType>("mittagessen");
  const [stationFilter, setStationFilter] = useState("alle");
  const [statusFilter, setStatusFilter] = useState("alle");
  const [assignmentOpen, setAssignmentOpen] = useState(false);
  const [editingStay, setEditingStay] = useState<InpatientStay | null>(null);
  const [stayForm, setStayForm] = useState<StayFormState>(buildStayFormState());
  const [selectionStayId, setSelectionStayId] = useState<string | null>(null);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string>("");
  const [specialInstructions, setSpecialInstructions] = useState("");
  const [overrideReason, setOverrideReason] = useState("");
  const [selectionCandidates, setSelectionCandidates] = useState<MealCandidate[]>([]);
  const [selectionAllergens, setSelectionAllergens] = useState<ReturnType<typeof getForPatient>>([]);

  const patientMap = useMemo(
    () => new Map(patients.map((patient) => [patient.id, patient])),
    [patients],
  );

  const activeStays = useMemo(
    () => stays.filter((stay) => stay.status === "active"),
    [stays],
  );

  const stationOptions = useMemo(() => {
    const values = new Set(activeStays.map((stay) => stay.station));
    return Array.from(values).sort((a, b) => a.localeCompare(b, "de"));
  }, [activeStays]);

  const serviceOrders = useMemo(
    () => orders.filter((order) => order.date === selectedDate && order.mealSlot === selectedMealSlot),
    [orders, selectedDate, selectedMealSlot],
  );

  const orderByStayId = useMemo(
    () => new Map(serviceOrders.map((order) => [order.inpatientStayId, order])),
    [serviceOrders],
  );

  const filteredStays = useMemo(() => {
    return activeStays.filter((stay) => {
      if (stationFilter !== "alle" && stay.station !== stationFilter) return false;
      const order = orderByStayId.get(stay.id);
      if (statusFilter !== "alle" && order?.status !== statusFilter) return false;
      if (statusFilter !== "alle" && !order && statusFilter !== "pending") return false;
      return true;
    });
  }, [activeStays, orderByStayId, stationFilter, statusFilter]);

  const staysByStation = useMemo(() => {
    const grouped = new Map<string, InpatientStay[]>();
    for (const stay of filteredStays) {
      const list = grouped.get(stay.station) ?? [];
      list.push(stay);
      grouped.set(stay.station, list);
    }
    return Array.from(grouped.entries()).sort(([a], [b]) => a.localeCompare(b, "de"));
  }, [filteredStays]);

  const kitchenOrders = useMemo(() => {
    return serviceOrders.filter((order) => stationFilter === "alle" || order.station === stationFilter);
  }, [serviceOrders, stationFilter]);

  const kitchenSummary = useMemo(() => buildKitchenSummary(kitchenOrders), [kitchenOrders]);
  const pendingOrderCount = serviceOrders.filter((order) => order.status === "pending").length;
  const missingOrderCount = Math.max(0, activeStays.length - serviceOrders.length);
  const kitchenPortionCount = kitchenSummary.reduce((sum, item) => sum + item.totalPortions, 0);
  const safetyEscalations = useMemo(() => {
    const blockedStays = activeStays.filter((stay) => {
      const candidates = buildMealCandidates({
        stay,
        recipes: recipeSource,
        menu: activeMenu,
        date: selectedDate,
        mealSlot: selectedMealSlot,
        allergens: getForPatient(stay.patientId),
      });
      return activeMenu && candidates.length > 0 && !candidates.some((candidate) => candidate.isSelectable);
    });
    const allergenStays = activeStays.filter((stay) => getForPatient(stay.patientId).length > 0);
    const heldOrCancelledOrders = serviceOrders.filter((order) => order.status === "cancelled");

    return [
      {
        label: "Keine sichere Menüoption",
        value: blockedStays.length,
        helper: "Kostform/Allergen blockiert alle Optionen",
        className: blockedStays.length > 0 ? "border-red-300 bg-red-50 text-red-800" : "border-emerald-200 bg-emerald-50 text-emerald-800",
      },
      {
        label: "Allergenhinweis",
        value: allergenStays.length,
        helper: "aktive Belegungen mit Allergien",
        className: allergenStays.length > 0 ? "border-amber-300 bg-amber-50 text-amber-800" : "border-emerald-200 bg-emerald-50 text-emerald-800",
      },
      {
        label: "Ohne Bestellung",
        value: missingOrderCount,
        helper: "aktive Betten im Servicefenster",
        className: missingOrderCount > 0 ? "border-amber-300 bg-amber-50 text-amber-800" : "border-emerald-200 bg-emerald-50 text-emerald-800",
      },
      {
        label: "Küchenfreigabe offen",
        value: pendingOrderCount,
        helper: "Bestellungen noch ausstehend",
        className: pendingOrderCount > 0 ? "border-blue-300 bg-blue-50 text-blue-800" : "border-emerald-200 bg-emerald-50 text-emerald-800",
      },
      {
        label: "Storniert",
        value: heldOrCancelledOrders.length,
        helper: "muss vor Ausgabe geklärt werden",
        className: heldOrCancelledOrders.length > 0 ? "border-red-300 bg-red-50 text-red-800" : "border-emerald-200 bg-emerald-50 text-emerald-800",
      },
    ];
  }, [activeMenu, activeStays, getForPatient, missingOrderCount, pendingOrderCount, recipeSource, selectedDate, selectedMealSlot, serviceOrders]);
  const criticalWorklist = useMemo(() => {
    const confirmedCount = serviceOrders.filter((order) => order.status === "confirmed").length;
    const deliveredCount = serviceOrders.filter((order) => order.status === "delivered").length;
    return [
      {
        label: "Ohne Bestellung",
        value: missingOrderCount,
        helper: "aktive Betten",
        className: missingOrderCount > 0 ? "text-amber-700" : "text-emerald-700",
      },
      {
        label: "Ausstehend",
        value: pendingOrderCount,
        helper: "Küchenfreigabe",
        className: pendingOrderCount > 0 ? "text-amber-700" : "text-emerald-700",
      },
      {
        label: "Bestätigt",
        value: confirmedCount,
        helper: "bereit für Ausgabe",
        className: "text-blue-700",
      },
      {
        label: "Ausgeliefert",
        value: deliveredCount,
        helper: "abgeschlossen",
        className: "text-emerald-700",
      },
    ];
  }, [serviceOrders, missingOrderCount, pendingOrderCount]);

  const selectionStay = useMemo(
    () => activeStays.find((stay) => stay.id === selectionStayId) ?? null,
    [activeStays, selectionStayId],
  );

  const selectionPatient = selectionStay ? patientMap.get(selectionStay.patientId) : undefined;
  const selectionOrder = selectionStay ? orderByStayId.get(selectionStay.id) : undefined;

  function openAssignmentDialog(stay?: InpatientStay) {
    setEditingStay(stay ?? null);
    setStayForm(buildStayFormState(stay));
    setAssignmentOpen(true);
  }

  function toggleDietForm(dietFormId: string, checked: boolean) {
    setStayForm((prev) => ({
      ...prev,
      dietFormIds: checked
        ? [...prev.dietFormIds, dietFormId]
        : prev.dietFormIds.filter((item) => item !== dietFormId),
    }));
  }

  function handleSaveStay() {
    if (!stayForm.patientId || !stayForm.room || !stayForm.bed || stayForm.dietFormIds.length === 0) {
      toast.error("Bitte Patient, Zimmer, Bett und mindestens eine Kostform angeben.");
      return;
    }

    if (editingStay) {
      updateStay(editingStay.id, {
        patientId: stayForm.patientId,
        station: stayForm.station,
        room: stayForm.room,
        bed: stayForm.bed,
        admissionDate: stayForm.admissionDate,
        notes: stayForm.notes || undefined,
        dietFormIds: stayForm.dietFormIds,
      });
      toast.success("Stationszuordnung aktualisiert");
    } else {
      addStay({
        patientId: stayForm.patientId,
        station: stayForm.station,
        room: stayForm.room,
        bed: stayForm.bed,
        admissionDate: stayForm.admissionDate,
        notes: stayForm.notes || undefined,
        dietFormIds: stayForm.dietFormIds,
        status: "active",
      });
      toast.success("Stationszuordnung angelegt");
    }

    setAssignmentOpen(false);
  }

  function handleDischarge(stay: InpatientStay) {
    updateStay(stay.id, {
      status: "discharged",
      dischargeDate: selectedDate,
    });
    toast.success("Patient entlassen");
  }

  function openSelectionDialog(stay: InpatientStay) {
    const existingOrder = orderByStayId.get(stay.id);
    const nextAllergens = getForPatient(stay.patientId);
    const nextCandidates = buildMealCandidates({
      stay,
      recipes: recipeSource,
      menu: activeMenu,
      date: selectedDate,
      mealSlot: selectedMealSlot,
      allergens: nextAllergens,
    });
    setSelectionStayId(stay.id);
    setSelectedCandidateId(existingOrder?.recipeId ?? "");
    setSpecialInstructions(existingOrder?.specialInstructions ?? "");
    setOverrideReason("");
    setSelectionAllergens(nextAllergens);
    setSelectionCandidates(nextCandidates);
  }

  function closeSelectionDialog() {
    setSelectionStayId(null);
    setSelectedCandidateId("");
    setSpecialInstructions("");
    setOverrideReason("");
    setSelectionAllergens([]);
    setSelectionCandidates([]);
  }

  function handleSaveSelection() {
    if (!selectionStay || !selectionPatient) {
      toast.error("Patientendaten fehlen.");
      return;
    }

    const candidate = selectionCandidates.find((item) => item.recipeId === selectedCandidateId);
    if (!candidate) {
      toast.error("Bitte eine Menüoption auswählen.");
      return;
    }

    if (!candidate.isSelectable && overrideReason.trim().length < 8) {
      toast.error("Bitte den Override mit einem nachvollziehbaren Grund dokumentieren.");
      return;
    }

    const overrideNotes = !candidate.isSelectable
      ? [
          specialInstructions.trim(),
          `Override: ${overrideReason.trim()}`,
          `Konflikte: ${candidate.blockedReasons.join("; ")}`,
        ].filter(Boolean).join("\n")
      : specialInstructions;
    const orderPayload = buildMealOrder({
      existingOrder: selectionOrder,
      stay: selectionStay,
      patient: selectionPatient,
      candidate,
      date: selectedDate,
      mealSlot: selectedMealSlot,
      allergens: selectionAllergens,
      specialInstructions: overrideNotes,
    });

    upsertOrder(orderPayload);
    if (!candidate.isSelectable) {
      void writeAccessAuditLog(createBrowserSupabaseClient(), {
        action: "diet_order_override_logged",
        targetType: "meal_order",
        targetId: selectionOrder?.id ?? `${selectionStay.id}:${selectedDate}:${selectedMealSlot}`,
        metadata: {
          patientId: selectionStay.patientId,
          inpatientStayId: selectionStay.id,
          patientName: `${selectionPatient.firstName} ${selectionPatient.lastName}`,
          recipeId: candidate.recipeId,
          recipeName: candidate.recipeName,
          date: selectedDate,
          mealSlot: selectedMealSlot,
          blockedReasons: candidate.blockedReasons,
          overrideReason: overrideReason.trim(),
        },
      });
    }
    toast.success("Stationsbestellung gespeichert");
    closeSelectionDialog();
  }

  function openTrayCards() {
    const url = getTrayCardPrintUrl({
      date: selectedDate,
      mealSlot: selectedMealSlot,
      station: stationFilter,
    });
    window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Krankenhausverwaltung"
        description="Inpatient-Zuordnung, sichere Essensauswahl und Stationsausgabe"
        helpText="Pflege oder Ernährungsberatung ordnet Patienten Betten zu, wählt sichere Menüoptionen je Servicefenster aus und erstellt Küchen- sowie Tablettenausgaben."
      >
        <Button onClick={() => openAssignmentDialog()}>
          <UserPlus className="mr-2 h-4 w-4" />
          Patient zuweisen
        </Button>
      </PageHeader>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Aktive Betten</CardTitle>
            <BedDouble className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeStays.length}</div>
            <p className="text-xs text-muted-foreground">{stationOptions.length} Stationen im Dienst</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Servicefenster</CardTitle>
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-sm font-semibold">{getSelectedServiceLabel(selectedDate, selectedMealSlot)}</div>
            <p className="text-xs text-muted-foreground">Aktives Menü: {activeMenu?.name ?? "Kein aktiver Plan"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Bestellungen</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{serviceOrders.length}</div>
            <p className="text-xs text-muted-foreground">
              {serviceOrders.filter((order) => order.status === "pending").length} ausstehend
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Küchencharge</CardTitle>
            <ChefHat className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kitchenPortionCount}</div>
            <p className="text-xs text-muted-foreground">{kitchenSummary.length} Rezeptgruppen im Service</p>
          </CardContent>
        </Card>
      </div>

      <div className="rounded-lg border bg-muted/30 p-3">
        <div className="grid gap-3 text-sm md:grid-cols-4">
          <div>
            <p className="text-xs font-medium uppercase text-muted-foreground">Servicefenster</p>
            <p className="font-semibold">{getSelectedServiceLabel(selectedDate, selectedMealSlot)}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase text-muted-foreground">Station</p>
            <p className="font-semibold">{stationFilter === "alle" ? "Alle Stationen" : stationFilter}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase text-muted-foreground">Offene Arbeit</p>
            <p className={pendingOrderCount + missingOrderCount > 0 ? "font-semibold text-amber-700" : "font-semibold text-emerald-700"}>
              {pendingOrderCount} ausstehend · {missingOrderCount} ohne Bestellung
            </p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase text-muted-foreground">Küche</p>
            <p className="font-semibold">{kitchenPortionCount} Portionen · {kitchenSummary.length} Gruppen</p>
          </div>
        </div>
      </div>

      <Card className="sticky top-16 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <CardContent className="flex flex-wrap items-end gap-4 pt-6">
          <div className="space-y-2">
            <Label htmlFor="service-date">Datum</Label>
            <Input
              id="service-date"
              type="date"
              value={selectedDate}
              onChange={(event) => setSelectedDate(event.target.value)}
              list="hospital-service-dates"
              className="w-full sm:w-[180px]"
            />
            <datalist id="hospital-service-dates">
              {selectableDates.map((date) => (
                <option key={date} value={date} />
              ))}
            </datalist>
          </div>
          <div className="space-y-2">
            <Label>Mahlzeit</Label>
            <Select value={selectedMealSlot} onValueChange={(value) => setSelectedMealSlot(value as MealSlotType)}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MEAL_SLOTS.map((slot) => (
                  <SelectItem key={slot} value={slot}>
                    {MEAL_SLOT_LABELS[slot]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Station</Label>
            <Select value={stationFilter} onValueChange={setStationFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="alle">Alle Stationen</SelectItem>
                {stationOptions.map((station) => (
                  <SelectItem key={station} value={station}>
                    {station}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="alle">Alle Status</SelectItem>
                {Object.entries(ORDER_STATUS_CONFIG).map(([value, config]) => (
                  <SelectItem key={value} value={value}>
                    {config.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2 sm:ml-auto">
            <Button variant="outline" onClick={openTrayCards}>
              <Printer className="mr-2 h-4 w-4" />
              Tablettenkarten
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-900/50 dark:bg-amber-950/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="h-4 w-4 text-amber-700" />
            Sicherheits- und Küchenlage
          </CardTitle>
          <CardDescription>
            Kritische Punkte für das aktuelle Servicefenster stehen vor der allgemeinen Bettenliste.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {safetyEscalations.map((item) => (
            <div key={item.label} className={`rounded-md border px-3 py-2 text-sm ${item.className}`}>
              <div className="flex items-center justify-between gap-3">
                <span className="font-medium">{item.label}</span>
                <span className="text-xl font-semibold tabular-nums">{item.value}</span>
              </div>
              <p className="mt-1 text-xs opacity-80">{item.helper}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dichte Arbeitsliste</CardTitle>
          <CardDescription>Operative Aufgaben für das aktuelle Servicefenster.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {criticalWorklist.map((item) => (
            <div key={item.label} className="rounded-md border px-3 py-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-medium">{item.label}</span>
                <span className={`text-xl font-semibold ${item.className}`}>{item.value}</span>
              </div>
              <p className="text-xs text-muted-foreground">{item.helper}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Tabs defaultValue="betten" className="space-y-4">
        <TabsList>
          <TabsTrigger value="betten">Bettenbelegung</TabsTrigger>
          <TabsTrigger value="bestellungen">Bestellungen</TabsTrigger>
          <TabsTrigger value="kueche">Küche</TabsTrigger>
        </TabsList>

        <TabsContent value="betten" className="space-y-6">
          {!activeMenu && (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                Kein aktiver Menüplan verfügbar. Bitte zuerst einen Menüplan aktivieren.
              </CardContent>
            </Card>
          )}

          {(staysLoading || ordersLoading) && (
            <Card>
              <CardContent className="py-4 text-sm text-muted-foreground">
                Stations- und Bestelldaten werden synchronisiert.
              </CardContent>
            </Card>
          )}

          {staysByStation.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                Keine aktiven Belegungen für den aktuellen Filter.
              </CardContent>
            </Card>
          ) : (
            staysByStation.map(([station, stationStays]) => (
              <div key={station} className="space-y-3">
                <h2 className="text-lg font-semibold">{station}</h2>
                <div className="grid gap-4 lg:grid-cols-2">
                  {stationStays.map((stay) => {
                    const patient = patientMap.get(stay.patientId);
                    const allergens = getForPatient(stay.patientId);
                    const order = orderByStayId.get(stay.id);
                    return (
                      <Card key={stay.id} className="border-l-4 border-l-primary/50">
                        <CardHeader className="pb-3">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <CardTitle className="text-base">
                                {patient ? `${patient.firstName} ${patient.lastName}` : stay.patientId}
                              </CardTitle>
                              <CardDescription>
                                Zi. {stay.room}-{stay.bed} · Aufnahme {formatDate(stay.admissionDate)}
                              </CardDescription>
                            </div>
                            {order ? (
                              <Badge variant="outline" className={ORDER_STATUS_CONFIG[order.status].className}>
                                {ORDER_STATUS_CONFIG[order.status].label}
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="border-orange-300 bg-orange-50 text-orange-700">
                                Keine Auswahl
                              </Badge>
                            )}
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="flex flex-wrap gap-1">{getDietBadges(stay.dietFormIds)}</div>
                          {allergens.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {allergens.map((entry) => (
                                <Badge
                                  key={entry.id}
                                  variant="outline"
                                  className="border-red-300 bg-red-50 text-red-700"
                                >
                                  {ALLERGEN_MAP.get(entry.allergenId)?.label ?? entry.allergenId}
                                </Badge>
                              ))}
                            </div>
                          )}
                          {order && (
                            <div className="rounded-md border bg-muted/30 p-3 text-sm">
                              <p className="font-medium">{order.recipeName}</p>
                              <p className="text-muted-foreground">{MEAL_SLOT_LABELS[order.mealSlot]}</p>
                              {order.specialInstructions && (
                                <p className="mt-2 text-xs text-muted-foreground">{order.specialInstructions}</p>
                              )}
                            </div>
                          )}
                          {stay.notes && <p className="text-xs text-muted-foreground">{stay.notes}</p>}
                          <div className="flex flex-wrap gap-2">
                            <Button
                              onClick={() => openSelectionDialog(stay)}
                              disabled={!activeMenu}
                            >
                              <Plus className="mr-2 h-4 w-4" />
                              Mahlzeit auswählen
                            </Button>
                            <Button variant="outline" onClick={() => openAssignmentDialog(stay)}>
                              <Pencil className="mr-2 h-4 w-4" />
                              Bearbeiten
                            </Button>
                            <Button variant="outline" onClick={() => handleDischarge(stay)}>
                              <XCircle className="mr-2 h-4 w-4" />
                              Entlassen
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </TabsContent>

        <TabsContent value="bestellungen">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Zimmer</TableHead>
                    <TableHead>Patient</TableHead>
                    <TableHead>Rezept</TableHead>
                    <TableHead>Kostform</TableHead>
                    <TableHead>Hinweise</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Aktionen</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {kitchenOrders.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                        Keine Bestellungen für dieses Servicefenster.
                      </TableCell>
                    </TableRow>
                  ) : (
                    kitchenOrders.map((order) => (
                      <TableRow key={order.id}>
                        <TableCell className="font-medium">
                          {order.station} · Zi. {order.room}-{order.bed}
                        </TableCell>
                        <TableCell>{order.patientName}</TableCell>
                        <TableCell>{order.recipeName}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {getDietBadges(order.dietFormIdsSnapshot)}
                          </div>
                        </TableCell>
                        <TableCell className="max-w-[260px] text-sm">
                          {order.specialInstructions ?? (order.restrictionSummary.join(", ") || "—")}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={ORDER_STATUS_CONFIG[order.status].className}>
                            {ORDER_STATUS_CONFIG[order.status].label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            {order.status === "pending" && (
                              <Button size="sm" variant="outline" onClick={() => updateOrderStatus(order.id, "confirmed")}>
                                <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                                Bestätigen
                              </Button>
                            )}
                            {order.status === "confirmed" && (
                              <Button size="sm" variant="outline" onClick={() => updateOrderStatus(order.id, "delivered")}>
                                <Truck className="mr-1 h-3.5 w-3.5" />
                                Ausliefern
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="kueche" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Portionen</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{kitchenOrders.length}</div>
                <p className="text-xs text-muted-foreground">Bestätigte oder ausstehende Einzelportionen</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Rezeptgruppen</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{kitchenSummary.length}</div>
                <p className="text-xs text-muted-foreground">Gebündelt nach Rezept und Service</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Druck</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-xs text-muted-foreground">Tablettenkarten für das aktuelle Servicefenster.</p>
                <Button asChild variant="outline" size="sm">
                  <Link href={getTrayCardPrintUrl({ date: selectedDate, mealSlot: selectedMealSlot, station: stationFilter })} target="_blank">
                    <Printer className="mr-2 h-4 w-4" />
                    Druckansicht öffnen
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Rezept</TableHead>
                    <TableHead>Portionen</TableHead>
                    <TableHead>Patienten</TableHead>
                    <TableHead>Sonderhinweise</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {kitchenSummary.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                        Noch keine Küchencharge für dieses Servicefenster.
                      </TableCell>
                    </TableRow>
                  ) : (
                    kitchenSummary.map((item) => (
                      <TableRow key={`${item.recipeId}:${item.mealSlot}`}>
                        <TableCell className="font-medium">{item.recipeName}</TableCell>
                        <TableCell>{item.totalPortions}</TableCell>
                        <TableCell>{item.patientNames.join(", ")}</TableCell>
                        <TableCell>{item.specialInstructions.join(" · ") || "—"}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={assignmentOpen} onOpenChange={setAssignmentOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingStay ? "Stationszuordnung bearbeiten" : "Patient zuweisen"}</DialogTitle>
            <DialogDescription>
              Verknüpfen Sie eine reale Patientenakte mit Station, Bett und Kostform.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label>Patient</Label>
              <Select
                value={stayForm.patientId}
                onValueChange={(value) => setStayForm((prev) => ({ ...prev, patientId: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Patient auswählen" />
                </SelectTrigger>
                <SelectContent>
                  {patients.map((patient) => (
                    <SelectItem key={patient.id} value={patient.id}>
                      {patient.firstName} {patient.lastName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Station</Label>
              <Input
                value={stayForm.station}
                onChange={(event) => setStayForm((prev) => ({ ...prev, station: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Aufnahmedatum</Label>
              <Input
                type="date"
                value={stayForm.admissionDate}
                onChange={(event) => setStayForm((prev) => ({ ...prev, admissionDate: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Zimmer</Label>
              <Input
                value={stayForm.room}
                onChange={(event) => setStayForm((prev) => ({ ...prev, room: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Bett</Label>
              <Input
                value={stayForm.bed}
                onChange={(event) => setStayForm((prev) => ({ ...prev, bed: event.target.value }))}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Kostformen</Label>
              <div className="grid gap-2 sm:grid-cols-2">
                {DIET_FORMS.filter((dietForm) => dietForm.isActive).map((dietForm) => (
                  <label key={dietForm.id} className="flex items-start gap-3 rounded-md border p-3">
                    <Checkbox
                      checked={stayForm.dietFormIds.includes(dietForm.id)}
                      onCheckedChange={(checked) => toggleDietForm(dietForm.id, checked === true)}
                    />
                    <span className="space-y-1">
                      <span className="block text-sm font-medium">{dietForm.name}</span>
                      <span className="block text-xs text-muted-foreground">{dietForm.description}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Hinweise</Label>
              <Textarea
                value={stayForm.notes}
                onChange={(event) => setStayForm((prev) => ({ ...prev, notes: event.target.value }))}
                placeholder="z. B. mobilisationsbedingt späterer Service"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignmentOpen(false)}>Abbrechen</Button>
            <Button onClick={handleSaveStay}>Speichern</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(selectionStayId)} onOpenChange={(open) => { if (!open) closeSelectionDialog(); }}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Sichere Menüauswahl</DialogTitle>
            <DialogDescription>
              {selectionPatient
                ? `${selectionPatient.firstName} ${selectionPatient.lastName} · ${getSelectedServiceLabel(selectedDate, selectedMealSlot)}`
                : "Servicefenster auswählen"}
            </DialogDescription>
          </DialogHeader>
          {selectionStay && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {getDietBadges(selectionStay.dietFormIds)}
                {selectionAllergens.map((entry) => (
                  <Badge key={entry.id} variant="outline" className="border-red-300 bg-red-50 text-red-700">
                    {ALLERGEN_MAP.get(entry.allergenId)?.label ?? entry.allergenId}
                  </Badge>
                ))}
              </div>
              {selectionCandidates.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    {!activeMenu
                      ? "Kein aktiver Menüplan verfügbar. Aktivieren Sie zuerst einen Menüplan."
                      : "Für dieses Servicefenster gibt es im aktiven Menü keine verfügbaren Optionen."}
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-3">
                  {selectionCandidates.map((candidate) => (
                    <button
                      key={candidate.recipeId}
                      type="button"
                      className={`rounded-lg border p-4 text-left transition ${
                        selectedCandidateId === candidate.recipeId
                          ? "border-primary bg-primary/5"
                          : "border-border"
                      } ${candidate.isSelectable ? "hover:border-primary/50" : "opacity-70"}`}
                      onClick={() => setSelectedCandidateId(candidate.recipeId)}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium">{candidate.recipeName}</p>
                          <div className="mt-2 flex flex-wrap gap-1">
                            {getDietBadges(candidate.dietFormIds)}
                          </div>
                        </div>
                        {candidate.isSelectable ? (
                          <Badge variant="outline" className="border-green-300 bg-green-50 text-green-700">
                            Sicher auswählbar
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="border-red-300 bg-red-50 text-red-700">
                            Geblockt
                          </Badge>
                        )}
                      </div>
                      {candidate.blockedReasons.length > 0 && (
                        <div className="mt-3 space-y-1">
                          {candidate.blockedReasons.map((reason) => (
                            <p key={`${candidate.recipeId}:${reason}`} className="text-xs text-red-700">
                              {reason}
                            </p>
                          ))}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
              {selectionCandidates.find((candidate) => candidate.recipeId === selectedCandidateId && !candidate.isSelectable) ? (
                <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                  <p className="font-medium">Unsichere Auswahl dokumentieren</p>
                  <p className="mt-1 text-xs">
                    Diese Bestellung verletzt Kostform- oder Allergenregeln. Speichern ist nur mit dokumentiertem Override-Grund möglich.
                  </p>
                  <div className="mt-3 space-y-2">
                    <Label htmlFor="meal-override-reason">Override-Grund</Label>
                    <Textarea
                      id="meal-override-reason"
                      value={overrideReason}
                      onChange={(event) => setOverrideReason(event.target.value)}
                      placeholder="z. B. ärztlich freigegeben, Allergenwarnung geprüft, alternative Ausgabe abgestimmt ..."
                    />
                  </div>
                </div>
              ) : null}
              <div className="space-y-2">
                <Label htmlFor="meal-special-instructions">Besondere Hinweise</Label>
                <Textarea
                  id="meal-special-instructions"
                  value={specialInstructions}
                  onChange={(event) => setSpecialInstructions(event.target.value)}
                  placeholder="Optional: Ausgabezeit, püriert servieren, Trinkmenge beachten ..."
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={closeSelectionDialog}>Abbrechen</Button>
            <Button onClick={handleSaveSelection}>Bestellung speichern</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
