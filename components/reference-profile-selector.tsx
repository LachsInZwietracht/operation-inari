"use client";

import { useMemo } from "react";
import { Info, Settings2 } from "lucide-react";
import Link from "next/link";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { REFERENCE_STANDARDS, AGE_GROUPS } from "@/lib/mock-data/reference-standards";
import { useReferenceProfiles } from "@/hooks/use-reference-profiles";
import { LIFE_STAGE_LABELS } from "@/lib/types/reference-values";
import type {
  Gender,
  LifeStage,
  ReferenceStandardId,
  ResolvedReferenceConfig,
} from "@/lib/types";
import {
  getAgeFromDateOfBirth,
  getAgeGroup,
  resolveReferenceForPatient,
} from "@/lib/reference-values";

interface ReferenceProfileSelectorProps {
  /** Patient date of birth for automatic age group resolution */
  dateOfBirth?: string;
  /** Patient gender */
  gender?: Gender;
  /** Callback when the resolved config changes */
  onChange?: (config: ResolvedReferenceConfig) => void;
  /** Compact mode: only shows standard selector and badge */
  compact?: boolean;
}

export function ReferenceProfileSelector({
  dateOfBirth,
  gender = "w",
  onChange,
  compact = false,
}: ReferenceProfileSelectorProps) {
  const {
    standardId,
    lifeStage,
    customProfiles,
    setStandard,
    setLifeStage,
  } = useReferenceProfiles();

  const resolvedGender: "m" | "w" = gender === "d" ? "w" : gender;

  const ageGroup = useMemo(() => {
    if (!dateOfBirth) return AGE_GROUPS.find((g) => g.id === "25-51")!;
    const age = getAgeFromDateOfBirth(dateOfBirth);
    return getAgeGroup(age);
  }, [dateOfBirth]);

  const handleStandardChange = (value: string) => {
    setStandard(value as ReferenceStandardId);
    // Resolve new config with the updated standard
    const config = resolveReferenceForPatient({
      standardId: value as ReferenceStandardId,
      dateOfBirth: dateOfBirth ?? "1990-01-01",
      gender,
      lifeStage,
    });
    onChange?.(config);
  };

  const handleLifeStageChange = (value: string) => {
    setLifeStage(value as LifeStage);
    const config = resolveReferenceForPatient({
      standardId,
      dateOfBirth: dateOfBirth ?? "1990-01-01",
      gender,
      lifeStage: value as LifeStage,
    });
    onChange?.(config);
  };

  const standard = REFERENCE_STANDARDS.find((s) => s.id === standardId);

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <Select value={standardId} onValueChange={handleStandardChange}>
          <SelectTrigger className="h-7 w-auto gap-1 text-xs px-2">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {REFERENCE_STANDARDS.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.shortName}
              </SelectItem>
            ))}
            {customProfiles.length > 0 && (
              <>
                {customProfiles.map((p) => (
                  <SelectItem key={p.id} value={`custom:${p.id}`}>
                    {p.name}
                  </SelectItem>
                ))}
              </>
            )}
          </SelectContent>
        </Select>
        <Badge variant="outline" className="text-xs font-normal">
          {ageGroup.label} · {resolvedGender === "m" ? "♂" : "♀"}
          {lifeStage !== "none" && ` · ${LIFE_STAGE_LABELS[lifeStage]}`}
        </Badge>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h4 className="text-sm font-medium">Referenzwerte</h4>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-3.5 w-3.5 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p>
                  Referenzwerte werden basierend auf Alter, Geschlecht und
                  Lebensphase des Patienten automatisch angepasst. Sie können
                  den Standard und besondere Lebensphasen hier ändern.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <Button variant="ghost" size="sm" className="h-7 text-xs" asChild>
          <Link href="/referenzwerte">
            <Settings2 className="mr-1 h-3 w-3" />
            Verwalten
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground">Standard</label>
          <Select value={standardId} onValueChange={handleStandardChange}>
            <SelectTrigger className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {REFERENCE_STANDARDS.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  <span className="flex items-center gap-2">
                    <span className="font-medium">{s.shortName}</span>
                    <span className="text-muted-foreground text-xs">
                      ({s.country})
                    </span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {resolvedGender === "w" && (
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">Lebensphase</label>
            <Select value={lifeStage} onValueChange={handleLifeStageChange}>
              <SelectTrigger className="h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Keine Besonderheit</SelectItem>
                <SelectItem value="pregnant_t1">Schwanger (1. Trim.)</SelectItem>
                <SelectItem value="pregnant_t2">Schwanger (2. Trim.)</SelectItem>
                <SelectItem value="pregnant_t3">Schwanger (3. Trim.)</SelectItem>
                <SelectItem value="lactating">Stillend</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant="secondary" className="text-xs">
          {standard?.shortName ?? standardId.toUpperCase()} {standard?.edition}
        </Badge>
        <Badge variant="outline" className="text-xs">
          {ageGroup.label}
        </Badge>
        <Badge variant="outline" className="text-xs">
          {resolvedGender === "m" ? "Männlich" : "Weiblich"}
        </Badge>
        {lifeStage !== "none" && (
          <Badge variant="outline" className="text-xs">
            {LIFE_STAGE_LABELS[lifeStage]}
          </Badge>
        )}
      </div>
    </div>
  );
}
