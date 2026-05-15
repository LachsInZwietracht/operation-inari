"use client";

import { useMemo } from "react";
import { AlertTriangle, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import {
  groupAdditivesByCategory,
  resolveAdditives,
  summarizeClinicalFlags,
  type ResolvedAdditive,
} from "@/lib/additives";

interface AdditiveListProps {
  codes: readonly string[];
  /**
   * "compact" renders a flat row of badges only; "detailed" groups by LMIV
   * functional class and surfaces a clinical-warning alert above the list.
   */
  variant?: "compact" | "detailed";
  /** Optional override — hides the clinical alert even in detailed mode. */
  showClinicalAlert?: boolean;
  className?: string;
}

export function AdditiveList({
  codes,
  variant = "detailed",
  showClinicalAlert = true,
  className,
}: AdditiveListProps) {
  const resolved = useMemo(() => resolveAdditives(codes), [codes]);

  if (resolved.length === 0) {
    return null;
  }

  if (variant === "compact") {
    return (
      <TooltipProvider delayDuration={200}>
        <div className={cn("flex flex-wrap gap-1", className)}>
          {resolved.map((additive) => (
            <AdditiveBadge key={additive.code} additive={additive} />
          ))}
        </div>
      </TooltipProvider>
    );
  }

  const grouped = groupAdditivesByCategory(resolved);
  const flags = showClinicalAlert ? summarizeClinicalFlags(resolved) : [];
  const warningFlags = flags.filter((flag) => flag.severity === "warning");
  const infoFlags = flags.filter((flag) => flag.severity === "info");

  return (
    <TooltipProvider delayDuration={200}>
      <div className={cn("space-y-3", className)}>
        {warningFlags.length > 0 && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Klinisch relevante Zusatzstoffe</AlertTitle>
            <AlertDescription>
              <ul className="mt-1 space-y-1 text-sm">
                {warningFlags.map((flag) => (
                  <li key={flag.flag}>
                    <span className="font-medium">{flag.label}:</span> {flag.description}{" "}
                    <span className="text-muted-foreground">
                      ({flag.contributors.map((c) => c.code).join(", ")})
                    </span>
                  </li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {infoFlags.length > 0 && (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>Hinweise zu Zusatzstoffen</AlertTitle>
            <AlertDescription>
              <ul className="mt-1 space-y-1 text-sm">
                {infoFlags.map((flag) => (
                  <li key={flag.flag}>
                    <span className="font-medium">{flag.label}:</span> {flag.description}{" "}
                    <span className="text-muted-foreground">
                      ({flag.contributors.map((c) => c.code).join(", ")})
                    </span>
                  </li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-2">
          {grouped.map(({ category, items }) => (
            <div key={category.id} className="space-y-1.5">
              <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                {category.label}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {items.map((additive) => (
                  <AdditiveBadge key={additive.code} additive={additive} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </TooltipProvider>
  );
}

interface AdditiveBadgeProps {
  additive: ResolvedAdditive;
}

function AdditiveBadge({ additive }: AdditiveBadgeProps) {
  const hasWarning = additive.clinicalFlags.length > 0;
  const trigger = (
    <Badge
      variant="outline"
      className={cn(
        "gap-1 border text-[11px] font-medium",
        additive.category.badgeClass,
        additive.isUnknown && "italic opacity-80",
      )}
    >
      <span className="font-mono">{additive.code}</span>
      {!additive.isUnknown && (
        <span className="font-normal opacity-80">· {additive.name}</span>
      )}
      {hasWarning && <AlertTriangle className="h-3 w-3" aria-hidden="true" />}
    </Badge>
  );

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span>{trigger}</span>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs space-y-1 text-xs">
        <p className="font-semibold">
          {additive.code}
          {!additive.isUnknown && ` – ${additive.name}`}
        </p>
        <p className="text-muted-foreground">{additive.category.label}</p>
        {additive.notes && <p>{additive.notes}</p>}
        {additive.isUnknown && (
          <p className="text-muted-foreground italic">
            Kein Eintrag im Katalog – Code wird unverändert angezeigt.
          </p>
        )}
      </TooltipContent>
    </Tooltip>
  );
}
