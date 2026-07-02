"use client";

import { useMemo, useState } from "react";
import {
  Check,
  Copy,
  Globe,
  Pencil,
  Plus,
  RotateCcw,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { REFERENCE_STANDARDS, AGE_GROUPS } from "@/lib/reference-metadata";
import { NUTRIENT_DEFINITIONS } from "@/lib/data/nutrient-definitions";
import { useReferenceProfiles, type ReferenceStoreSeed } from "@/hooks/use-reference-profiles";
import { resolveCustomProfile, resolveReferenceValues } from "@/lib/reference-values";
import { LIFE_STAGE_LABELS } from "@/lib/types/reference-values";
import { formatNutrient } from "@/lib/format";
import type {
  CustomReferenceProfile,
  LifeStage,
  NutrientGroup,
  ReferenceNutrientValue,
  ReferenceStandardId,
} from "@/lib/types";
import { NUTRIENT_GROUP_LABELS } from "@/lib/constants";
import { cn } from "@/lib/utils";

/** Slider bounds for relative nutrient scaling (percentage of the base value). */
const SCALE_MIN = 10;
const SCALE_MAX = 300;
const SCALE_STEP = 5;

/** Derived nutrients that are computed from others — not independently adjustable. */
const NON_ADJUSTABLE_NUTRIENTS = new Set(["energie_kj", "broteinheiten"]);

function roundAmount(value: number): number {
  return Math.round(value * 100) / 100;
}

function amountFromPercent(percent: number, base: number): number {
  return roundAmount((base * percent) / 100);
}

function ComparisonView({ initialReferenceState }: { initialReferenceState?: ReferenceStoreSeed }) {
  const { officialRows, customProfiles } = useReferenceProfiles({ initialState: initialReferenceState });
  const [selectedStandards, setSelectedStandards] = useState<Exclude<ReferenceStandardId, "custom">[]>(["dge"]);
  const [selectedProfileIds, setSelectedProfileIds] = useState<string[]>([]);
  const [ageGroupId, setAgeGroupId] = useState("25-51");
  const [gender, setGender] = useState<"m" | "w">("w");
  const [nutrientGroup, setNutrientGroup] = useState<NutrientGroup>("makronaehrstoffe");

  const resolvedValues = useMemo(() => {
    const standardColumns = selectedStandards.map((sid) => ({
      key: sid,
      label: REFERENCE_STANDARDS.find((s) => s.id === sid)?.shortName ?? sid.toUpperCase(),
      // Custom profiles carry their own demographic; standards follow the selectors above.
      sublabel: undefined as string | undefined,
      values: resolveReferenceValues(sid, ageGroupId, gender, "none", officialRows),
    }));

    const profileColumns = selectedProfileIds
      .map((id) => customProfiles.find((p) => p.id === id))
      .filter((p): p is NonNullable<typeof p> => Boolean(p))
      .map((profile) => ({
        key: profile.id,
        label: profile.name,
        sublabel: `${AGE_GROUPS.find((g) => g.id === profile.ageGroupId)?.label ?? profile.ageGroupId} · ${profile.gender === "m" ? "M" : "W"}`,
        values: resolveCustomProfile(profile, officialRows),
      }));

    return [...standardColumns, ...profileColumns];
  }, [selectedStandards, selectedProfileIds, customProfiles, ageGroupId, gender, officialRows]);

  const nutrients = useMemo(
    () =>
      NUTRIENT_DEFINITIONS.filter((d) => d.group === nutrientGroup).sort(
        (a, b) => a.sortOrder - b.sortOrder,
      ),
    [nutrientGroup],
  );

  const toggleStandard = (sid: Exclude<ReferenceStandardId, "custom">) => {
    setSelectedStandards((prev) =>
      prev.includes(sid) ? prev.filter((s) => s !== sid) : [...prev, sid],
    );
  };

  const toggleProfile = (id: string) => {
    setSelectedProfileIds((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id],
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Standards vergleichen</Label>
          <div className="flex gap-1">
            {REFERENCE_STANDARDS.map((s) => (
              <Button
                key={s.id}
                variant={selectedStandards.includes(s.id) ? "default" : "outline"}
                size="sm"
                className="h-7 text-xs"
                onClick={() => toggleStandard(s.id)}
              >
                {s.shortName}
              </Button>
            ))}
          </div>
        </div>
        {customProfiles.length > 0 && (
          <div className="space-y-1.5">
            <Label className="text-xs">Eigene Profile</Label>
            <div className="flex flex-wrap gap-1">
              {customProfiles.map((profile) => (
                <Button
                  key={profile.id}
                  variant={selectedProfileIds.includes(profile.id) ? "default" : "outline"}
                  size="sm"
                  className="h-7 max-w-[160px] text-xs"
                  title={profile.name}
                  onClick={() => toggleProfile(profile.id)}
                >
                  <span className="truncate">{profile.name}</span>
                </Button>
              ))}
            </div>
          </div>
        )}
        <div className="space-y-1.5">
          <Label className="text-xs">Altersgruppe</Label>
          <Select value={ageGroupId} onValueChange={setAgeGroupId}>
            <SelectTrigger className="h-8 w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {AGE_GROUPS.filter((g) => g.minAge >= 1).map((g) => (
                <SelectItem key={g.id} value={g.id}>
                  {g.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Geschlecht</Label>
          <Select value={gender} onValueChange={(v) => setGender(v as "m" | "w")}>
            <SelectTrigger className="h-8 w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="m">Männlich</SelectItem>
              <SelectItem value="w">Weiblich</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Tabs value={nutrientGroup} onValueChange={(v) => setNutrientGroup(v as NutrientGroup)}>
        <TabsList>
          {(Object.entries(NUTRIENT_GROUP_LABELS) as [NutrientGroup, string][]).map(
            ([key, label]) => (
              <TabsTrigger key={key} value={key}>
                {label}
              </TabsTrigger>
            ),
          )}
        </TabsList>

        <TabsContent value={nutrientGroup}>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[200px]">Nährstoff</TableHead>
                  <TableHead className="w-[80px]">Einheit</TableHead>
                  {resolvedValues.map((rv) => (
                    <TableHead key={rv.key} className="text-right">
                      <div className="flex flex-col items-end leading-tight">
                        <span className="truncate max-w-[140px]" title={rv.label}>
                          {rv.label}
                        </span>
                        {rv.sublabel && (
                          <span className="text-[10px] font-normal text-muted-foreground">
                            {rv.sublabel}
                          </span>
                        )}
                      </div>
                    </TableHead>
                  ))}
                  {resolvedValues.length >= 2 && (
                    <TableHead className="text-right w-[100px]">Differenz</TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {nutrients.map((nutrient) => {
                  const amounts = resolvedValues.map(
                    (rv) =>
                      rv.values.find((v) => v.nutrientId === nutrient.id)?.amount ?? 0,
                  );
                  const max = Math.max(...amounts);
                  const min = Math.min(...amounts);
                  const diffPercent =
                    min > 0 ? Math.round(((max - min) / min) * 100) : 0;

                  return (
                    <TableRow key={nutrient.id}>
                      <TableCell className="font-medium">{nutrient.name}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {nutrient.unit}
                      </TableCell>
                      {amounts.map((amount, i) => (
                        <TableCell
                          key={resolvedValues[i].key}
                          className="text-right tabular-nums"
                        >
                          {formatNutrient(amount, nutrient.unit)}
                        </TableCell>
                      ))}
                      {resolvedValues.length >= 2 && (
                        <TableCell className="text-right">
                          {diffPercent > 0 ? (
                            <Badge
                              variant={diffPercent > 20 ? "destructive" : "secondary"}
                              className="text-xs"
                            >
                              ±{diffPercent}%
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-xs">=</span>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function CustomProfileEditor({ initialReferenceState }: { initialReferenceState?: ReferenceStoreSeed }) {
  const { customProfiles, saveCustomProfile, deleteCustomProfile, officialRows } =
    useReferenceProfiles({ initialState: initialReferenceState });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newBaseStandard, setNewBaseStandard] = useState<Exclude<ReferenceStandardId, "custom">>("dge");
  const [newAgeGroup, setNewAgeGroup] = useState("25-51");
  const [newGender, setNewGender] = useState<"m" | "w">("w");
  const [newLifeStage, setNewLifeStage] = useState<LifeStage>("none");
  const [editOverrides, setEditOverrides] = useState<Map<string, number>>(new Map());

  const handleCreate = () => {
    if (!newName.trim()) return;

    const baseValues = resolveReferenceValues(
      newBaseStandard,
      newAgeGroup,
      newGender,
      newLifeStage,
      officialRows,
    );

    const overrides: ReferenceNutrientValue[] = [];
    for (const [nutrientId, amount] of editOverrides) {
      const baseVal = baseValues.find((v) => v.nutrientId === nutrientId)?.amount;
      if (baseVal !== amount) {
        overrides.push({ nutrientId, amount });
      }
    }

    const profile: CustomReferenceProfile = {
      id: crypto.randomUUID(),
      name: newName.trim(),
      basedOn: newBaseStandard,
      ageGroupId: newAgeGroup,
      gender: newGender,
      lifeStage: newLifeStage,
      overrides,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    saveCustomProfile(profile);
    setShowCreate(false);
    setNewName("");
    setEditOverrides(new Map());
    toast.success("Profil erstellt");
  };

  const handleStartEdit = (profile: CustomReferenceProfile) => {
    setEditingId(profile.id);
    const map = new Map<string, number>();
    for (const ov of profile.overrides) {
      map.set(ov.nutrientId, ov.amount);
    }
    setEditOverrides(map);
  };

  const handleSaveEdit = (profile: CustomReferenceProfile) => {
    const baseValues = resolveReferenceValues(
      (profile.basedOn ?? "dge") as Exclude<ReferenceStandardId, "custom">,
      profile.ageGroupId,
      profile.gender,
      profile.lifeStage,
      officialRows,
    );

    const overrides: ReferenceNutrientValue[] = [];
    for (const [nutrientId, amount] of editOverrides) {
      const baseVal = baseValues.find((v) => v.nutrientId === nutrientId)?.amount;
      if (baseVal !== amount) {
        overrides.push({ nutrientId, amount });
      }
    }

    saveCustomProfile({
      ...profile,
      overrides,
      updatedAt: new Date().toISOString(),
    });
    setEditingId(null);
    setEditOverrides(new Map());
    toast.success("Profil gespeichert");
  };

  const handleDuplicate = (profile: CustomReferenceProfile) => {
    const dup: CustomReferenceProfile = {
      ...profile,
      id: crypto.randomUUID(),
      name: `${profile.name} (Kopie)`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    saveCustomProfile(dup);
    toast.success("Profil dupliziert");
  };

  const baseValues = useMemo(() => {
    if (showCreate) {
      return resolveReferenceValues(newBaseStandard, newAgeGroup, newGender, newLifeStage, officialRows);
    }
    if (editingId) {
      const profile = customProfiles.find((p) => p.id === editingId);
      if (profile) {
        return resolveReferenceValues(
          (profile.basedOn ?? "dge") as Exclude<ReferenceStandardId, "custom">,
          profile.ageGroupId,
          profile.gender,
          profile.lifeStage,
          officialRows,
        );
      }
    }
    return [];
  }, [showCreate, editingId, newBaseStandard, newAgeGroup, newGender, newLifeStage, customProfiles, officialRows]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Erstellen Sie eigene Referenzprofile auf Basis eines Standards und skalieren Sie
          einzelne Nährstoffe per Schieberegler hoch oder runter — z. B. mehr Eiweiß oder
          weniger Natrium.
        </p>
        <Button size="sm" onClick={() => setShowCreate(true)}>
          <Plus className="mr-1 h-4 w-4" />
          Neues Profil
        </Button>
      </div>

      {customProfiles.length === 0 && !showCreate && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <p>Keine eigenen Profile vorhanden.</p>
            <p className="text-xs mt-1">
              Erstellen Sie ein Profil, um individuelle Nährstoff-Referenzwerte festzulegen.
            </p>
          </CardContent>
        </Card>
      )}

      {customProfiles.map((profile) => {
        const isEditing = editingId === profile.id;
        const standard = REFERENCE_STANDARDS.find((s) => s.id === profile.basedOn);
        const ageGroup = AGE_GROUPS.find((g) => g.id === profile.ageGroupId);
        const summaryBase =
          !isEditing && profile.overrides.length > 0
            ? resolveReferenceValues(
                (profile.basedOn ?? "dge") as Exclude<ReferenceStandardId, "custom">,
                profile.ageGroupId,
                profile.gender,
                profile.lifeStage,
                officialRows,
              )
            : [];

        return (
          <Card key={profile.id}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">{profile.name}</CardTitle>
                  <CardDescription>
                    Basiert auf {standard?.shortName ?? "–"} · {ageGroup?.label} ·{" "}
                    {profile.gender === "m" ? "Männlich" : "Weiblich"}
                    {profile.lifeStage !== "none" &&
                      ` · ${LIFE_STAGE_LABELS[profile.lifeStage]}`}
                  </CardDescription>
                </div>
                <div className="flex gap-1">
                  {isEditing ? (
                    <>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setEditingId(null);
                          setEditOverrides(new Map());
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                      <Button size="sm" onClick={() => handleSaveEdit(profile)}>
                        <Save className="mr-1 h-4 w-4" />
                        Speichern
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDuplicate(profile)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleStartEdit(profile)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        onClick={() => {
                          deleteCustomProfile(profile.id);
                          toast.success("Profil gelöscht");
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </CardHeader>
            {isEditing && (
              <CardContent>
                <NutrientOverrideTable
                  baseValues={baseValues}
                  overrides={editOverrides}
                  onOverrideChange={setEditOverrides}
                />
              </CardContent>
            )}
            {!isEditing && profile.overrides.length > 0 && (
              <CardContent>
                <p className="text-xs text-muted-foreground mb-2">
                  {profile.overrides.length} angepasste Werte:
                </p>
                <div className="flex flex-wrap gap-1">
                  {profile.overrides.map((ov) => {
                    const def = NUTRIENT_DEFINITIONS.find((d) => d.id === ov.nutrientId);
                    const base = summaryBase.find((v) => v.nutrientId === ov.nutrientId)?.amount ?? 0;
                    const delta = base > 0 ? Math.round(((ov.amount - base) / base) * 100) : null;
                    return (
                      <Badge key={ov.nutrientId} variant="secondary" className="text-xs">
                        {def?.shortName ?? ov.nutrientId}: {formatNutrient(ov.amount, def?.unit ?? "")}
                        {delta != null && delta !== 0 && (
                          <span className="ml-1 text-primary">
                            ({delta > 0 ? "+" : ""}
                            {delta}%)
                          </span>
                        )}
                      </Badge>
                    );
                  })}
                </div>
              </CardContent>
            )}
          </Card>
        );
      })}

      {/* Create dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="flex max-h-[min(90dvh,900px)] w-[calc(100vw-2rem)] max-w-3xl flex-col gap-0 overflow-hidden p-0">
          <DialogHeader className="shrink-0 border-b px-6 py-5">
            <DialogTitle>Neues Referenzprofil erstellen</DialogTitle>
            <DialogDescription>
              Wählen Sie einen Standard als Grundlage und passen Sie einzelne Nährstoffwerte an.
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
            <div className="space-y-5">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Name</Label>
                  <Input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="z.B. Diabetiker-Profil"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Basiert auf</Label>
                  <Select value={newBaseStandard} onValueChange={(v) => setNewBaseStandard(v as Exclude<ReferenceStandardId, "custom">)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {REFERENCE_STANDARDS.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.shortName} ({s.country})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Altersgruppe</Label>
                  <Select value={newAgeGroup} onValueChange={setNewAgeGroup}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {AGE_GROUPS.filter((g) => g.minAge >= 1).map((g) => (
                        <SelectItem key={g.id} value={g.id}>
                          {g.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Geschlecht</Label>
                  <Select value={newGender} onValueChange={(v) => setNewGender(v as "m" | "w")}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="m">Männlich</SelectItem>
                      <SelectItem value="w">Weiblich</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {newGender === "w" && (
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label>Lebensphase</Label>
                    <Select value={newLifeStage} onValueChange={(v) => setNewLifeStage(v as LifeStage)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.entries(LIFE_STAGE_LABELS) as [LifeStage, string][]).map(
                          ([key, label]) => (
                            <SelectItem key={key} value={key}>
                              {label}
                            </SelectItem>
                          ),
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              <Separator />

              <div className="space-y-2">
                <Label>Nährstoffwerte anpassen (optional)</Label>
                <p className="text-xs text-muted-foreground">
                  Skalieren Sie einzelne Nährstoffe per Schieberegler relativ zum Basiswert
                  (100 % = Standard) oder tragen Sie einen Zielwert direkt ein. Nicht geänderte
                  Werte werden vom Basis-Standard übernommen.
                </p>
                <NutrientOverrideTable
                  baseValues={baseValues}
                  overrides={editOverrides}
                  onOverrideChange={setEditOverrides}
                />
              </div>
            </div>
          </div>

          <DialogFooter className="shrink-0 border-t bg-background px-6 py-4">
            <Button variant="outline" onClick={() => setShowCreate(false)}>
              Abbrechen
            </Button>
            <Button onClick={handleCreate} disabled={!newName.trim()}>
              <Check className="mr-1 h-4 w-4" />
              Profil erstellen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function NutrientOverrideTable({
  baseValues,
  overrides,
  onOverrideChange,
}: {
  baseValues: ReferenceNutrientValue[];
  overrides: Map<string, number>;
  onOverrideChange: (overrides: Map<string, number>) => void;
}) {
  // Raw text drafts while a numeric field is being typed, so intermediate
  // states like "1," or "" don't get clobbered before they parse.
  const [drafts, setDrafts] = useState<Map<string, string>>(new Map());

  const setAmount = (nutrientId: string, amount: number, base: number) => {
    const next = new Map(overrides);
    // A value that rounds back to the base is treated as "no override".
    if (base > 0 && Math.abs(amount - base) < 0.005) {
      next.delete(nutrientId);
    } else {
      next.set(nutrientId, roundAmount(amount));
    }
    onOverrideChange(next);
  };

  const resetOverride = (nutrientId: string) => {
    const next = new Map(overrides);
    next.delete(nutrientId);
    onOverrideChange(next);
    clearDraft(nutrientId);
  };

  const setDraft = (nutrientId: string, raw: string) => {
    setDrafts((prev) => new Map(prev).set(nutrientId, raw));
  };

  const clearDraft = (nutrientId: string) => {
    setDrafts((prev) => {
      if (!prev.has(nutrientId)) return prev;
      const next = new Map(prev);
      next.delete(nutrientId);
      return next;
    });
  };

  const groups: NutrientGroup[] = ["makronaehrstoffe", "vitamine", "mineralstoffe"];

  return (
    <div className="space-y-4">
      {groups.map((group) => {
        const nutrients = NUTRIENT_DEFINITIONS.filter(
          (d) => d.group === group && !NON_ADJUSTABLE_NUTRIENTS.has(d.id),
        ).sort((a, b) => a.sortOrder - b.sortOrder);

        return (
          <div key={group}>
            <h5 className="text-xs font-medium text-muted-foreground mb-2">
              {NUTRIENT_GROUP_LABELS[group]}
            </h5>
            <div className="rounded-md border">
              <Table className="table-fixed">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[32%]">Nährstoff</TableHead>
                    <TableHead className="text-right w-[16%]">Basis</TableHead>
                    <TableHead className="w-[30%]">Skalierung</TableHead>
                    <TableHead className="text-right w-[18%]">Zielwert</TableHead>
                    <TableHead className="w-[4%]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {nutrients.map((nutrient) => {
                    const base =
                      baseValues.find((v) => v.nutrientId === nutrient.id)?.amount ?? 0;
                    const hasOverride = overrides.has(nutrient.id);
                    const currentVal = hasOverride ? overrides.get(nutrient.id)! : base;
                    const canScale = base > 0;
                    const percent = canScale ? Math.round((currentVal / base) * 100) : 100;
                    const sliderPercent = Math.min(
                      SCALE_MAX,
                      Math.max(SCALE_MIN, percent),
                    );
                    const draft = drafts.get(nutrient.id);
                    const inputValue =
                      draft !== undefined
                        ? draft
                        : formatNutrient(currentVal, nutrient.unit);

                    return (
                      <TableRow
                        key={nutrient.id}
                        className={hasOverride ? "bg-accent/40" : ""}
                      >
                        <TableCell className="text-sm">
                          {nutrient.name}
                          <span className="ml-1 text-xs text-muted-foreground">
                            ({nutrient.unit})
                          </span>
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground text-sm">
                          {formatNutrient(base, nutrient.unit)}
                        </TableCell>
                        <TableCell>
                          {canScale ? (
                            <div className="flex items-center gap-2">
                              <Slider
                                value={[sliderPercent]}
                                min={SCALE_MIN}
                                max={SCALE_MAX}
                                step={SCALE_STEP}
                                aria-label={`${nutrient.name} skalieren`}
                                className="min-w-0 flex-1"
                                onValueChange={([next]) => {
                                  clearDraft(nutrient.id);
                                  setAmount(nutrient.id, amountFromPercent(next, base), base);
                                }}
                              />
                              <span
                                className={cn(
                                  "w-11 shrink-0 text-right text-xs tabular-nums",
                                  hasOverride
                                    ? "font-medium text-primary"
                                    : "text-muted-foreground",
                                )}
                              >
                                {percent}%
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              Kein Basiswert – Zielwert direkt eingeben
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Input
                            inputMode="decimal"
                            className="ml-auto h-7 w-full text-right text-sm tabular-nums"
                            value={inputValue}
                            onChange={(e) => {
                              setDraft(nutrient.id, e.target.value);
                              const parsed = parseFloat(e.target.value.replace(",", "."));
                              if (!isNaN(parsed) && parsed >= 0) {
                                setAmount(nutrient.id, parsed, base);
                              }
                            }}
                            onBlur={() => clearDraft(nutrient.id)}
                          />
                        </TableCell>
                        <TableCell>
                          {hasOverride && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              title="Auf Basiswert zurücksetzen"
                              aria-label="Auf Basiswert zurücksetzen"
                              onClick={() => resetOverride(nutrient.id)}
                            >
                              <RotateCcw className="h-3 w-3" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function ReferenzwertePageClient({
  initialReferenceState,
}: {
  initialReferenceState?: ReferenceStoreSeed
}) {
  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Referenzwerte"
        description="Nährstoff-Referenzwerte nach DGE, ÖGE, SGE und RDA — mit Vergleich und eigenen Profilen"
        helpText="Referenzwerte bilden die Grundlage für die Nährstoffanalyse. Vergleichen Sie die hinterlegten Standards (DGE, ÖGE, SGE, RDA) oder erstellen Sie eigene Profile, in denen Sie einzelne Nährstoffe per Schieberegler an Ziel oder Indikation anpassen."
      />

      <Tabs defaultValue="comparison">
        <TabsList>
          <TabsTrigger value="comparison">
            <Globe className="mr-1 h-4 w-4" />
            Vergleich
          </TabsTrigger>
          <TabsTrigger value="custom">
            <Pencil className="mr-1 h-4 w-4" />
            Eigene Profile
          </TabsTrigger>
        </TabsList>

        <TabsContent value="comparison" className="space-y-4 mt-4">
          <ComparisonView initialReferenceState={initialReferenceState} />
        </TabsContent>

        <TabsContent value="custom" className="space-y-4 mt-4">
          <CustomProfileEditor initialReferenceState={initialReferenceState} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
