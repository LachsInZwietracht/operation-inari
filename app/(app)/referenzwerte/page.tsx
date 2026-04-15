"use client";

import { useMemo, useState } from "react";
import {
  ArrowRight,
  Check,
  Copy,
  Globe,
  Pencil,
  Plus,
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
import { REFERENCE_STANDARDS, AGE_GROUPS } from "@/lib/mock-data/reference-standards";
import { NUTRIENT_DEFINITIONS } from "@/lib/data/nutrient-definitions";
import { useReferenceProfiles } from "@/hooks/use-reference-profiles";
import { resolveReferenceValues } from "@/lib/reference-values";
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

const FLAG_EMOJI: Record<string, string> = {
  DE: "🇩🇪",
  AT: "🇦🇹",
  CH: "🇨🇭",
  US: "🇺🇸",
};

function ComparisonView() {
  const [selectedStandards, setSelectedStandards] = useState<ReferenceStandardId[]>(["dge", "rda"]);
  const [ageGroupId, setAgeGroupId] = useState("25-51");
  const [gender, setGender] = useState<"m" | "w">("w");
  const [nutrientGroup, setNutrientGroup] = useState<NutrientGroup>("makronaehrstoffe");

  const resolvedValues = useMemo(() => {
    return selectedStandards.map((sid) => ({
      standardId: sid,
      standard: REFERENCE_STANDARDS.find((s) => s.id === sid)!,
      values: resolveReferenceValues(sid, ageGroupId, gender),
    }));
  }, [selectedStandards, ageGroupId, gender]);

  const nutrients = useMemo(
    () =>
      NUTRIENT_DEFINITIONS.filter((d) => d.group === nutrientGroup).sort(
        (a, b) => a.sortOrder - b.sortOrder,
      ),
    [nutrientGroup],
  );

  const toggleStandard = (sid: ReferenceStandardId) => {
    setSelectedStandards((prev) =>
      prev.includes(sid) ? prev.filter((s) => s !== sid) : [...prev, sid],
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
                    <TableHead key={rv.standardId} className="text-right">
                      {rv.standard.shortName}
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
                          key={resolvedValues[i].standardId}
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

function CustomProfileEditor() {
  const { customProfiles, saveCustomProfile, deleteCustomProfile } =
    useReferenceProfiles();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newBaseStandard, setNewBaseStandard] = useState<ReferenceStandardId>("dge");
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
    );

    const overrides: ReferenceNutrientValue[] = [];
    for (const [nutrientId, amount] of editOverrides) {
      const baseVal = baseValues.find((v) => v.nutrientId === nutrientId)?.amount;
      if (baseVal !== amount) {
        overrides.push({ nutrientId, amount });
      }
    }

    const profile: CustomReferenceProfile = {
      id: `custom-${Date.now()}`,
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
      profile.basedOn ?? "dge",
      profile.ageGroupId,
      profile.gender,
      profile.lifeStage,
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
      id: `custom-${Date.now()}`,
      name: `${profile.name} (Kopie)`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    saveCustomProfile(dup);
    toast.success("Profil dupliziert");
  };

  const baseValues = useMemo(() => {
    if (showCreate) {
      return resolveReferenceValues(newBaseStandard, newAgeGroup, newGender, newLifeStage);
    }
    if (editingId) {
      const profile = customProfiles.find((p) => p.id === editingId);
      if (profile) {
        return resolveReferenceValues(
          profile.basedOn ?? "dge",
          profile.ageGroupId,
          profile.gender,
          profile.lifeStage,
        );
      }
    }
    return [];
  }, [showCreate, editingId, newBaseStandard, newAgeGroup, newGender, newLifeStage, customProfiles]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Erstellen Sie eigene Referenzprofile basierend auf einem Standard mit individuellen Anpassungen.
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
                    return (
                      <Badge key={ov.nutrientId} variant="secondary" className="text-xs">
                        {def?.shortName ?? ov.nutrientId}: {formatNutrient(ov.amount, def?.unit ?? "")}
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
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Neues Referenzprofil erstellen</DialogTitle>
            <DialogDescription>
              Wählen Sie einen Standard als Grundlage und passen Sie einzelne Nährstoffwerte an.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-4">
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
              <Select value={newBaseStandard} onValueChange={(v) => setNewBaseStandard(v as ReferenceStandardId)}>
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
              <div className="col-span-2 space-y-1.5">
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
              Klicken Sie auf einen Wert, um ihn zu ändern. Nicht geänderte Werte werden vom Basis-Standard übernommen.
            </p>
            <NutrientOverrideTable
              baseValues={baseValues}
              overrides={editOverrides}
              onOverrideChange={setEditOverrides}
            />
          </div>

          <DialogFooter>
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
  const [editingNutrient, setEditingNutrient] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const handleStartEdit = (nutrientId: string, currentValue: number) => {
    setEditingNutrient(nutrientId);
    setEditValue(String(currentValue));
  };

  const handleConfirmEdit = (nutrientId: string) => {
    const parsed = parseFloat(editValue.replace(",", "."));
    if (!isNaN(parsed) && parsed >= 0) {
      const next = new Map(overrides);
      next.set(nutrientId, parsed);
      onOverrideChange(next);
    }
    setEditingNutrient(null);
  };

  const handleResetOverride = (nutrientId: string) => {
    const next = new Map(overrides);
    next.delete(nutrientId);
    onOverrideChange(next);
  };

  const groups: NutrientGroup[] = ["makronaehrstoffe", "vitamine", "mineralstoffe"];

  return (
    <div className="space-y-4">
      {groups.map((group) => {
        const nutrients = NUTRIENT_DEFINITIONS.filter((d) => d.group === group).sort(
          (a, b) => a.sortOrder - b.sortOrder,
        );

        return (
          <div key={group}>
            <h5 className="text-xs font-medium text-muted-foreground mb-2">
              {NUTRIENT_GROUP_LABELS[group]}
            </h5>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[160px]">Nährstoff</TableHead>
                    <TableHead className="w-[60px]">Einheit</TableHead>
                    <TableHead className="text-right w-[100px]">Basis</TableHead>
                    <TableHead className="text-right w-[120px]">Wert</TableHead>
                    <TableHead className="w-[40px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {nutrients.map((nutrient) => {
                    const baseVal =
                      baseValues.find((v) => v.nutrientId === nutrient.id)?.amount ?? 0;
                    const hasOverride = overrides.has(nutrient.id);
                    const currentVal = hasOverride ? overrides.get(nutrient.id)! : baseVal;
                    const isEditing = editingNutrient === nutrient.id;

                    return (
                      <TableRow
                        key={nutrient.id}
                        className={hasOverride ? "bg-accent/50" : ""}
                      >
                        <TableCell className="text-sm">{nutrient.name}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {nutrient.unit}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground text-sm">
                          {formatNutrient(baseVal, nutrient.unit)}
                        </TableCell>
                        <TableCell className="text-right">
                          {isEditing ? (
                            <form
                              className="flex justify-end"
                              onSubmit={(e) => {
                                e.preventDefault();
                                handleConfirmEdit(nutrient.id);
                              }}
                            >
                              <Input
                                autoFocus
                                className="h-7 w-20 text-right text-sm"
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onBlur={() => handleConfirmEdit(nutrient.id)}
                              />
                            </form>
                          ) : (
                            <button
                              type="button"
                              className="tabular-nums text-sm hover:underline cursor-pointer font-medium"
                              onClick={() => handleStartEdit(nutrient.id, currentVal)}
                            >
                              {formatNutrient(currentVal, nutrient.unit)}
                              {hasOverride && currentVal !== baseVal && (
                                <span className="ml-1 text-xs text-blue-600">
                                  ({currentVal > baseVal ? "+" : ""}
                                  {Math.round(((currentVal - baseVal) / baseVal) * 100)}%)
                                </span>
                              )}
                            </button>
                          )}
                        </TableCell>
                        <TableCell>
                          {hasOverride && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              onClick={() => handleResetOverride(nutrient.id)}
                            >
                              <X className="h-3 w-3" />
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

export default function ReferenzwertePage() {
  const { standardId, setStandard } = useReferenceProfiles();

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Referenzwerte"
        description="Nährstoff-Referenzwerte nach DGE, ÖGE, SGE und RDA — mit Vergleich und eigenen Profilen"
        helpText="Referenzwerte bilden die Grundlage für die Nährstoffanalyse. Wählen Sie den passenden Standard für Ihre Region und passen Sie Werte bei Bedarf mit eigenen Profilen an."
      />

      {/* Active standard quick-switch */}
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground">Aktiver Standard:</span>
        <div className="flex gap-1">
          {REFERENCE_STANDARDS.map((s) => (
            <Button
              key={s.id}
              variant={standardId === s.id ? "default" : "outline"}
              size="sm"
              onClick={() => setStandard(s.id)}
            >
              {s.shortName}
            </Button>
          ))}
        </div>
      </div>

      {/* Standard overview cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {REFERENCE_STANDARDS.map((s) => (
          <Card
            key={s.id}
            data-testid={`reference-standard-${s.id}`}
            className={
              standardId === s.id
                ? "ring-2 ring-primary"
                : ""
            }
          >
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">
                  {FLAG_EMOJI[s.country]} {s.shortName}
                </CardTitle>
                {standardId === s.id && (
                  <Badge variant="default" className="text-xs">
                    Aktiv
                  </Badge>
                )}
              </div>
              <CardDescription className="text-xs">{s.name}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">{s.description}</p>
              <div className="mt-2 flex items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  Edition {s.edition}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {s.brackets.filter((br) => br.lifeStage === "none").length} Altersgruppen
                </Badge>
              </div>
              {standardId !== s.id && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-2 w-full text-xs"
                  onClick={() => setStandard(s.id)}
                >
                  Als Standard setzen
                  <ArrowRight className="ml-1 h-3 w-3" />
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

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
          <ComparisonView />
        </TabsContent>

        <TabsContent value="custom" className="space-y-4 mt-4">
          <CustomProfileEditor />
        </TabsContent>
      </Tabs>
    </div>
  );
}
