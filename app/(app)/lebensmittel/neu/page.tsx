"use client";

import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { Layers3, Plus } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { useCustomFoods } from "@/hooks/use-custom-foods";
import { FOOD_CATEGORIES, FOOD_SOURCES } from "@/lib/mock-data";
import type { FoodSourceId } from "@/lib/types";

const ALLERGENS = [
  "Gluten",
  "Milch",
  "Ei",
  "Soja",
  "Schalenfrüchte",
  "Sellerie",
  "Fisch",
  "Sesam",
];

const nutrientSchema = z.object({
  name: z.string().min(1, "Name ist erforderlich"),
  categoryId: z.string().min(1, "Kategorie wählen"),
  manufacturer: z.string().optional(),
  sourceId: z.string().min(1),
  baseAmount: z.coerce.number().min(1),
  energie: z.coerce.number().min(0),
  eiweiss: z.coerce.number().min(0),
  fett: z.coerce.number().min(0),
  kohlenhydrate: z.coerce.number().min(0),
  ballaststoffe: z.coerce.number().min(0),
  co2PerPortion: z.coerce.number().min(0).optional(),
  additives: z.string().optional(),
  notes: z.string().optional(),
  allergens: z.array(z.string()).optional(),
  portionSizes: z
    .array(
      z.object({
        label: z.string().min(1),
        amount: z.coerce.number().min(1),
      }),
    )
    .min(1),
});

export default function NeuesLebensmittelPage() {
  const router = useRouter();
  const { addFood } = useCustomFoods();

  const form = useForm<z.infer<typeof nutrientSchema>>({
    resolver: zodResolver(nutrientSchema),
    defaultValues: {
      name: "",
      categoryId: FOOD_CATEGORIES[0]?.id ?? "",
      sourceId: "custom",
      baseAmount: 100,
      energie: 0,
      eiweiss: 0,
      fett: 0,
      kohlenhydrate: 0,
      ballaststoffe: 0,
      portionSizes: [{ label: "Portion", amount: 100 }],
      allergens: [],
    },
  });

  const { fields, append, remove } = useFieldArray({ name: "portionSizes", control: form.control });

  const onSubmit = (values: z.infer<typeof nutrientSchema>) => {
    const sourceMeta = FOOD_SOURCES.find((source) => source.id === values.sourceId);
    const nutrients = [
      { nutrientId: "energie", amount: values.energie },
      { nutrientId: "eiweiss", amount: values.eiweiss },
      { nutrientId: "fett", amount: values.fett },
      { nutrientId: "kohlenhydrate", amount: values.kohlenhydrate },
      { nutrientId: "ballaststoffe", amount: values.ballaststoffe },
    ];

    const additives = values.additives
      ? values.additives.split(",").map((token) => token.trim()).filter(Boolean)
      : undefined;

    const food = addFood({
      name: values.name,
      categoryId: values.categoryId,
      manufacturer: values.manufacturer,
      source: sourceMeta?.name ?? "Eigene Eingabe",
      sourceId: values.sourceId as FoodSourceId,
      sourceVersion: sourceMeta?.version,
      baseAmount: values.baseAmount,
      nutrients,
      portionSizes: values.portionSizes,
      co2PerPortion: values.co2PerPortion,
      additives,
      allergens: values.allergens,
    });

    router.push(`/lebensmittel/${food.id}`);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Neues Lebensmittel"
        description="Eigene Produkte, Herstellerartikel oder Rezeptumsetzungen erfassen"
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Layers3 className="h-5 w-5" />
            Lebensmittel-Stammdaten
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form className="space-y-6" onSubmit={form.handleSubmit(onSubmit)}>
              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Produktname" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="manufacturer"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Hersteller</FormLabel>
                      <FormControl>
                        <Input placeholder="Optional" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <FormField
                  control={form.control}
                  name="categoryId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Kategorie</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Kategorie" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {FOOD_CATEGORIES.map((category) => (
                            <SelectItem key={category.id} value={category.id}>
                              {category.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="sourceId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Quelle</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Quelle" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {FOOD_SOURCES.map((source) => (
                            <SelectItem key={source.id} value={source.id}>
                              {source.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="baseAmount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Basis-Menge (g)</FormLabel>
                      <FormControl>
                        <Input type="number" min={1} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <Card className="border-dashed">
                <CardHeader>
                  <CardTitle className="text-sm font-medium">Portionsgrößen</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {fields.map((field, index) => (
                    <div key={field.id} className="grid gap-2 md:grid-cols-[2fr,1fr,auto]">
                      <FormField
                        control={form.control}
                        name={`portionSizes.${index}.label`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs text-muted-foreground">Bezeichnung</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`portionSizes.${index}.amount`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs text-muted-foreground">Gramm</FormLabel>
                            <FormControl>
                              <Input type="number" min={1} {...field} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <Button type="button" variant="ghost" onClick={() => remove(index)}>
                        Entfernen
                      </Button>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => append({ label: "Neue Portion", amount: 100 })}
                  >
                    <Plus className="mr-1 h-4 w-4" /> Portion hinzufügen
                  </Button>
                </CardContent>
              </Card>

              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm font-medium">Makronährstoffe (pro 100 g)</CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-3">
                    {(["energie", "eiweiss", "fett", "kohlenhydrate", "ballaststoffe"] as const).map(
                      (fieldName) => (
                        <FormField
                          key={fieldName}
                          control={form.control}
                          name={fieldName}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="uppercase text-xs text-muted-foreground">
                                {fieldName}
                              </FormLabel>
                              <FormControl>
                                <Input type="number" min={0} step="0.1" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      ),
                    )}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm font-medium">Allergene & Zusatzstoffe</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <FormField
                      control={form.control}
                      name="allergens"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs text-muted-foreground">Allergene</FormLabel>
                          <div className="grid grid-cols-2 gap-2">
                            {ALLERGENS.map((allergen) => (
                              <label key={allergen} className="flex items-center gap-2 text-sm">
                                <Checkbox
                                  checked={field.value?.includes(allergen)}
                                  onCheckedChange={(checked) => {
                                    const next = field.value ?? [];
                                    if (checked) {
                                      field.onChange([...next, allergen]);
                                    } else {
                                      field.onChange(next.filter((item) => item !== allergen));
                                    }
                                  }}
                                />
                                {allergen}
                              </label>
                            ))}
                          </div>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="additives"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs text-muted-foreground">Zusatzstoffe (kommagetrennt)</FormLabel>
                          <FormControl>
                            <Input placeholder="z.B. E300, E471" {...field} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="co2PerPortion"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs text-muted-foreground">CO₂ je Portion (kg)</FormLabel>
                          <FormControl>
                            <Input type="number" min={0} step="0.01" {...field} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>
              </div>

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notizen</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Besondere Hinweise, LMIV-Angaben..." rows={4} {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />

              <div className="flex justify-end">
                <Button type="submit">Speichern &amp; anzeigen</Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
