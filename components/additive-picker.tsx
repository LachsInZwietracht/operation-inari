"use client";

import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { ADDITIVES, ADDITIVE_CATEGORIES } from "@/lib/reference-data/additives";
import { lookupAdditive, normalizeAdditiveCode } from "@/lib/additives";

interface AdditivePickerProps {
  /** Stored values — canonical codes such as "E951". */
  value: string[];
  onChange: (next: string[]) => void;
  className?: string;
}

const CATEGORY_LABEL_BY_ID = new Map(
  ADDITIVE_CATEGORIES.map((category) => [category.id, category.label]),
);

interface CatalogOption {
  code: string;
  name: string;
  categoryLabel: string;
  /** Pre-normalised search text – avoids re-allocating on every keystroke. */
  search: string;
}

const CATALOG_OPTIONS: CatalogOption[] = ADDITIVES.map((additive) => {
  const categoryLabel = CATEGORY_LABEL_BY_ID.get(additive.categoryId) ?? "Sonstige";
  return {
    code: additive.code,
    name: additive.name,
    categoryLabel,
    search: `${additive.code} ${additive.name} ${categoryLabel}`.toLowerCase(),
  };
});

/**
 * Multi-select combobox for assigning Zusatzstoffe to a food. Lets the user
 * pick from the curated registry by code OR name, and accepts free-form
 * tokens via Enter so custom or out-of-catalog codes can still be captured.
 */
export function AdditivePicker({ value, onChange, className }: AdditivePickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selected = useMemo(() => new Set(value.map(normalizeAdditiveCode)), [value]);
  const trimmedQuery = query.trim();
  const normalizedQuery = normalizeAdditiveCode(trimmedQuery);
  const canAddCustom =
    trimmedQuery.length > 0 &&
    !selected.has(normalizedQuery) &&
    !CATALOG_OPTIONS.some((option) => option.code === normalizedQuery);

  function toggle(code: string) {
    const canonical = normalizeAdditiveCode(code);
    if (!canonical) return;
    if (selected.has(canonical)) {
      onChange(value.filter((existing) => normalizeAdditiveCode(existing) !== canonical));
    } else {
      onChange([...value, canonical]);
    }
  }

  function remove(code: string) {
    const canonical = normalizeAdditiveCode(code);
    onChange(value.filter((existing) => normalizeAdditiveCode(existing) !== canonical));
  }

  function addCustom() {
    if (!canAddCustom) return;
    onChange([...value, normalizedQuery]);
    setQuery("");
  }

  return (
    <div className={cn("space-y-2", className)}>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((code) => {
            const canonical = normalizeAdditiveCode(code);
            const additive = lookupAdditive(canonical);
            return (
              <Badge
                key={canonical}
                variant="secondary"
                className="gap-1 pr-1 text-[11px] font-medium"
              >
                <span className="font-mono">{canonical}</span>
                {additive && <span className="font-normal opacity-80">· {additive.name}</span>}
                <button
                  type="button"
                  onClick={() => remove(code)}
                  className="hover:bg-background/60 ml-0.5 rounded-sm p-0.5"
                  aria-label={`Zusatzstoff ${canonical} entfernen`}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            );
          })}
        </div>
      )}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between"
          >
            <span className="text-muted-foreground">
              {value.length === 0
                ? "E-Nummer oder Name suchen…"
                : `${value.length} Zusatzstoff${value.length === 1 ? "" : "e"} ausgewählt`}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command
            filter={(_, search, keywords) => {
              const haystack = (keywords ?? []).join(" ").toLowerCase();
              const needle = search.trim().toLowerCase();
              if (!needle) return 1;
              return haystack.includes(needle) ? 1 : 0;
            }}
          >
            <CommandInput
              placeholder="z. B. E951, Aspartam, Süßungsmittel…"
              value={query}
              onValueChange={setQuery}
            />
            <CommandList>
              <CommandEmpty>
                {canAddCustom ? (
                  <button
                    type="button"
                    onClick={addCustom}
                    className="hover:bg-accent flex w-full items-center gap-2 rounded-sm px-2 py-2 text-left text-sm"
                  >
                    <Plus className="h-4 w-4" />
                    <span>
                      <span className="font-mono font-medium">{normalizedQuery}</span> als
                      individuellen Zusatzstoff hinzufügen
                    </span>
                  </button>
                ) : (
                  <span className="text-muted-foreground">Kein Treffer.</span>
                )}
              </CommandEmpty>
              <CommandGroup heading="Katalog">
                {CATALOG_OPTIONS.map((option) => {
                  const isSelected = selected.has(option.code);
                  return (
                    <CommandItem
                      key={option.code}
                      value={option.code}
                      keywords={[option.code, option.name, option.categoryLabel]}
                      onSelect={() => toggle(option.code)}
                    >
                      <Check
                        className={cn(
                          "h-4 w-4",
                          isSelected ? "opacity-100" : "opacity-0",
                        )}
                      />
                      <div className="flex flex-col">
                        <span className="font-mono text-sm">
                          {option.code}{" "}
                          <span className="text-muted-foreground font-sans font-normal">
                            · {option.name}
                          </span>
                        </span>
                        <span className="text-muted-foreground text-xs">
                          {option.categoryLabel}
                        </span>
                      </div>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
