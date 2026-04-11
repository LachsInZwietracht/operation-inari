"use client";

import { useState } from "react";
import { Sparkles, Plus, Trash2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import type { Food, FoodSynonym } from "@/lib/types";

interface FoodSynonymManagerProps {
  food: Food;
  synonyms: FoodSynonym[];
  activeSynonymId: string | null;
  addSynonym: (foodId: string, name: string, options?: { locale?: string; makePrimary?: boolean }) => FoodSynonym | null;
  deleteSynonym: (synonymId: string) => void;
  setPrimarySynonym: (foodId: string, synonymId: string | null) => void;
}

const LOCALES = [
  { value: "de-DE", label: "Deutsch" },
  { value: "en-US", label: "Englisch" },
  { value: "fr-FR", label: "Französisch" },
  { value: "it-IT", label: "Italienisch" },
];

export function FoodSynonymManager({
  food,
  synonyms,
  activeSynonymId,
  addSynonym,
  deleteSynonym,
  setPrimarySynonym,
}: FoodSynonymManagerProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [locale, setLocale] = useState("de-DE");
  const [makePrimary, setMakePrimary] = useState(true);

  const handleAdd = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const created = addSynonym(food.id, name, { locale, makePrimary });
    if (created) {
      toast.success(`Alias „${created.name}“ gespeichert`);
      setName("");
    }
  };

  const handleDelete = (synonym: FoodSynonym) => {
    deleteSynonym(synonym.id);
    toast.success(`Alias „${synonym.name}“ entfernt`);
  };

  const handlePrimary = (synonymId: string | null) => {
    setPrimarySynonym(food.id, synonymId);
    toast.success(
      synonymId
        ? "Anzeigename aktualisiert"
        : "Originalbezeichnung wiederhergestellt",
    );
  };

  const systemSynonyms = synonyms.filter((syn) => syn.source === "system");
  const userSynonyms = synonyms.filter((syn) => syn.source !== "system");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="text-xs text-muted-foreground"
          onClick={(event) => event.stopPropagation()}
        >
          <Sparkles className="mr-1 h-3.5 w-3.5" /> Aliase verwalten
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Synonyme für {food.name}</DialogTitle>
          <DialogDescription>
            Aliase erscheinen in der Suche und können als Anzeigename in Rezepten
            verwendet werden.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-5">
          <section className="space-y-3">
            {[systemSynonyms, userSynonyms].map((group, index) => (
              <div key={index} className="space-y-2">
                {group.map((synonym) => {
                  const isPrimary = activeSynonymId === synonym.id;
                  const canRemove = synonym.source !== "system";
                  return (
                    <div
                      key={synonym.id}
                      className="flex items-center justify-between rounded-md border bg-muted/40 p-3"
                    >
                      <div>
                        <p className="font-medium">{synonym.name}</p>
                        <p className="text-muted-foreground text-xs">
                          {synonym.locale ?? "–"} · {synonym.createdBy} · {synonym.usageCount ?? 0} Verwendungen
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {isPrimary ? (
                          <Badge className="bg-emerald-100 text-emerald-900">
                            <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Anzeigename
                          </Badge>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handlePrimary(synonym.id)}
                          >
                            Als Anzeigename
                          </Button>
                        )}
                        {canRemove && (
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Alias ${synonym.name} löschen`}
                            onClick={() => handleDelete(synonym)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
                {group.length === 0 && index === 1 && (
                  <p className="text-muted-foreground text-sm">
                    Noch keine eigenen Synonyme vorhanden.
                  </p>
                )}
              </div>
            ))}
          </section>

          <section>
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium">Neuen Alias speichern</h4>
              {activeSynonymId && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handlePrimary(null)}
                >
                  Originalnamen verwenden
                </Button>
              )}
            </div>
            <form onSubmit={handleAdd} className="mt-3 space-y-3">
              <Input
                placeholder="z.B. Nudeln"
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-muted-foreground mb-1 block text-xs">
                    Sprache
                  </label>
                  <Select value={locale} onValueChange={setLocale}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sprache wählen" />
                    </SelectTrigger>
                    <SelectContent>
                      {LOCALES.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={makePrimary}
                    onCheckedChange={(checked) => setMakePrimary(Boolean(checked))}
                  />
                  Als Anzeigename verwenden
                </label>
              </div>
              <Button type="submit" className="w-full">
                <Plus className="mr-2 h-4 w-4" /> Alias hinzufügen
              </Button>
            </form>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
