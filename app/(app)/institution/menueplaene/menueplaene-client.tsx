"use client";

import { useCallback, useMemo, useState, type DragEvent } from "react";
import {
  Printer,
  Calendar,
  Utensils,
  GripVertical,
  X,
  ShoppingCart,
  ClipboardList,
  ChevronDown,
  ChevronRight,
  Plus,
  Trash2,
  Check,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

import { DIET_FORMS, DAY_LABELS } from "@/lib/reference-data/institution";
import { MEAL_SLOT_LABELS } from "@/lib/constants";
import { useInstitutionMenu } from "@/hooks/use-institution-menu";
import { formatNumber } from "@/lib/format";
import { createRecipeLookup } from "@/lib/recipes";
import type {
  InstitutionMenu,
  MenuCycleLength,
  MealSlotType,
  ProductionItem,
  ShoppingItem,
  Recipe,
} from "@/lib/types";

// ─── Constants ────────────��──────────────────���───────────────────────────────

const VISIBLE_MEAL_SLOTS: MealSlotType[] = [
  "fruehstueck",
  "mittagessen",
  "abendessen",
];

const STATUS_CONFIG: Record<
  InstitutionMenu["status"],
  { label: string; variant: "default" | "secondary" | "outline" }
> = {
  active: { label: "Aktiv", variant: "default" },
  draft: { label: "Entwurf", variant: "secondary" },
  archived: { label: "Archiviert", variant: "outline" },
};

const MEAL_SLOT_COLORS: Record<string, string> = {
  fruehstueck: "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800",
  mittagessen: "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800",
  abendessen: "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800",
};

const DRAG_TYPE_RECIPE_ID = "application/prodi-institution-recipe-id";

// ─── Helpers ─────────���─────────────────────────────��─────────────────────────

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function getDietFormName(dietFormId: string): string {
  return DIET_FORMS.find((d) => d.id === dietFormId)?.name ?? dietFormId;
}

function formatAmount(amount: number, unit: string): { value: string; unit: string } {
  if (unit === "ml" || unit === "l") {
    if (amount >= 1000 && unit === "ml") {
      return { value: formatNumber(amount / 1000, 2), unit: "l" };
    }
    return { value: formatNumber(amount, 1), unit };
  }
  if (amount >= 1000) {
    return { value: formatNumber(amount / 1000, 2), unit: "kg" };
  }
  return { value: formatNumber(amount, 1), unit: "g" };
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(value);
}

// ─── Recipe Sidebar Item (Draggable) ─���───────────────────────────────────────

function RecipeDragItem({ recipe }: { recipe: Recipe }) {
  const handleDragStart = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.dataTransfer.setData(DRAG_TYPE_RECIPE_ID, recipe.id);
      e.dataTransfer.effectAllowed = "copy";
    },
    [recipe.id],
  );

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      className="flex items-center gap-2 rounded-md border bg-card px-3 py-2 cursor-grab active:cursor-grabbing hover:bg-accent/50 transition-colors"
    >
      <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate">{recipe.name}</p>
        <p className="text-xs text-muted-foreground">{recipe.category}</p>
      </div>
    </div>
  );
}

// ─── Droppable Slot Cell ─────────────���─────────────────────���─────────────────

interface SlotCellProps {
  recipeId?: string;
  recipeName?: string;
  portionCount?: number;
  slotType: MealSlotType;
  onDrop: (recipeId: string) => void;
  onRemove: () => void;
  onPortionChange: (count: number) => void;
}

function SlotCell({
  recipeId,
  recipeName,
  portionCount,
  slotType,
  onDrop,
  onRemove,
  onPortionChange,
}: SlotCellProps) {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = useCallback((e: DragEvent<HTMLTableCellElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent<HTMLTableCellElement>) => {
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent<HTMLTableCellElement>) => {
      e.preventDefault();
      setIsDragOver(false);
      const droppedRecipeId = e.dataTransfer.getData(DRAG_TYPE_RECIPE_ID);
      if (droppedRecipeId) {
        onDrop(droppedRecipeId);
      }
    },
    [onDrop],
  );

  return (
    <TableCell
      className={cn(
        "text-center p-1.5 transition-all min-w-[130px]",
        isDragOver && "bg-primary/10 ring-2 ring-inset ring-primary/40 rounded",
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {recipeId ? (
        <div
          className={cn(
            "rounded-md p-2 border relative group",
            MEAL_SLOT_COLORS[slotType] ?? "bg-muted",
          )}
        >
          <button
            type="button"
            onClick={onRemove}
            className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-destructive text-destructive-foreground items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity hidden group-hover:flex"
            aria-label="Entfernen"
          >
            <X className="h-3 w-3" />
          </button>
          <div className="text-sm font-medium leading-tight">
            {recipeName ?? recipeId}
          </div>
          <div className="mt-1 flex items-center justify-center gap-1">
            <Input
              type="number"
              min={1}
              value={portionCount ?? 1}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10);
                if (!isNaN(v) && v > 0) onPortionChange(v);
              }}
              className="h-6 w-14 text-center text-xs px-1"
            />
            <span className="text-xs text-muted-foreground">Port.</span>
          </div>
        </div>
      ) : (
        <div
          className={cn(
            "rounded-md border border-dashed p-3 text-xs text-muted-foreground transition-colors",
            isDragOver
              ? "border-primary bg-primary/5 text-primary"
              : "border-muted-foreground/30",
          )}
        >
          {isDragOver ? "Hier ablegen" : "Rezept hierher ziehen"}
        </div>
      )}
    </TableCell>
  );
}

// ─── Production Panel ─────────────────────────��──────────────────────────────

function ProductionPanel({
  items,
  dayLabel,
}: {
  items: ProductionItem[];
  dayLabel: string;
}) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const totalPortions = items.reduce((s, i) => s + i.portionCount, 0);
  const totalIngredients = items.reduce((s, i) => s + i.ingredients.length, 0);

  function toggleRow(key: string) {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(key)) { next.delete(key); } else { next.add(key); }
      return next;
    });
  }

  if (items.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-8">
        Keine Rezepte für diesen Tag geplant.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 text-sm">
        <Badge variant="outline">{dayLabel}</Badge>
        <span className="text-muted-foreground">
          {items.length} Rezepte &middot; {totalPortions} Portionen &middot;{" "}
          {totalIngredients} Zutaten
        </span>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-8" />
            <TableHead>Rezept</TableHead>
            <TableHead>Kostform</TableHead>
            <TableHead>Mahlzeit</TableHead>
            <TableHead className="text-right">Portionen</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => {
            const key = `${item.recipeId}_${item.dietFormId}_${item.mealSlot}`;
            const isOpen = expandedRows.has(key);
            return (
              <TableRow key={key} className="group">
                <TableCell>
                  <button
                    type="button"
                    onClick={() => toggleRow(key)}
                    className="p-0.5"
                  >
                    {isOpen ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                  </button>
                </TableCell>
                <TableCell className="font-medium">{item.recipeName}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-xs">
                    {getDietFormName(item.dietFormId)}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {MEAL_SLOT_LABELS[item.mealSlot]}
                </TableCell>
                <TableCell className="text-right font-medium">
                  {item.portionCount}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      {/* Expanded ingredient details */}
      {items
        .filter((item) =>
          expandedRows.has(`${item.recipeId}_${item.dietFormId}_${item.mealSlot}`),
        )
        .map((item) => {
          const key = `${item.recipeId}_${item.dietFormId}_${item.mealSlot}`;
          return (
            <Card key={`detail-${key}`} className="bg-muted/30">
              <CardHeader className="py-3">
                <CardTitle className="text-sm">
                  {item.recipeName} — Zutatenliste ({item.portionCount} Portionen)
                </CardTitle>
              </CardHeader>
              <CardContent className="py-0 pb-3">
                <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
                  {item.ingredients.map((ing) => {
                    const fmt = formatAmount(ing.totalAmount, ing.unit);
                    return (
                      <div
                        key={ing.foodId}
                        className="flex items-center justify-between rounded-md border bg-background px-3 py-1.5 text-sm"
                      >
                        <span>{ing.foodName}</span>
                        <span className="ml-2 font-medium tabular-nums">
                          {fmt.value} {fmt.unit}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          );
        })}
    </div>
  );
}

// ─── Shopping Panel ──────────────────────────��───────────────────────────────

function ShoppingPanel({ items }: { items: ShoppingItem[] }) {
  const [portionScale, setPortionScale] = useState(1);

  const groupedByCategory = useMemo(() => {
    const groups = new Map<
      string,
      { categoryName: string; items: ShoppingItem[]; subtotal: number }
    >();
    for (const item of items) {
      const existing = groups.get(item.categoryId) ?? {
        categoryName: item.categoryName,
        items: [],
        subtotal: 0,
      };
      existing.items.push(item);
      existing.subtotal += item.estimatedCost;
      groups.set(item.categoryId, existing);
    }
    return Array.from(groups.values());
  }, [items]);

  const totalCost = items.reduce((s, i) => s + i.estimatedCost, 0);
  const scaledTotal = totalCost * portionScale;

  if (items.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-8">
        Keine Einkaufsdaten verfügbar. Planen Sie zuerst Rezepte in der Wochenübersicht.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        <span className="text-sm text-muted-foreground">
          {items.length} Positionen
        </span>
        <div className="flex items-center gap-2 ml-auto">
          <label htmlFor="scale" className="text-sm text-muted-foreground whitespace-nowrap">
            Portionsfaktor:
          </label>
          <Input
            id="scale"
            type="number"
            min={0.1}
            step={0.1}
            value={portionScale}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              if (!isNaN(v) && v > 0) setPortionScale(v);
            }}
            className="w-20 h-8"
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            const csv = [
              "Lebensmittel;Menge;Einheit;Kategorie;Kosten",
              ...items.map((i) => {
                const fmt = formatAmount(i.totalAmount * portionScale, "g");
                return `${i.foodName};${fmt.value};${fmt.unit};${i.categoryName};${formatCurrency(i.estimatedCost * portionScale)}`;
              }),
            ].join("\n");
            const blob = new Blob([csv], { type: "text/csv" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "einkaufsliste.csv";
            a.click();
            URL.revokeObjectURL(url);
            toast.success("CSV-Export heruntergeladen");
          }}
        >
          <ShoppingCart className="mr-1.5 h-4 w-4" />
          CSV exportieren
        </Button>
      </div>

      {groupedByCategory.map((group) => (
        <Card key={group.categoryName}>
          <CardHeader className="pb-2 py-3">
            <CardTitle className="flex items-center justify-between text-sm">
              <span>{group.categoryName}</span>
              <span className="text-xs font-normal text-muted-foreground">
                {formatCurrency(group.subtotal * portionScale)}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableBody>
                {group.items.map((item) => {
                  const fmt = formatAmount(item.totalAmount * portionScale, "g");
                  return (
                    <TableRow key={item.foodId}>
                      <TableCell className="font-medium text-sm py-2">
                        {item.foodName}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm py-2">
                        {fmt.value} {fmt.unit}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm text-muted-foreground py-2">
                        {formatCurrency(item.estimatedCost * portionScale)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ))}

      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="flex items-center justify-between py-4">
          <span className="text-sm font-medium text-muted-foreground">
            Gesamtkosten (Woche)
          </span>
          <span className="text-xl font-bold">{formatCurrency(scaledTotal)}</span>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Portion Count Dialog ───────────────────��────────────────────────────────

function PortionDialog({
  open,
  onOpenChange,
  onConfirm,
  recipeName,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onConfirm: (count: number) => void;
  recipeName: string;
}) {
  const [count, setCount] = useState(30);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Portionen festlegen</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <p className="text-sm text-muted-foreground">
            Wie viele Portionen sollen für <span className="font-medium text-foreground">{recipeName}</span> geplant werden?
          </p>
          <Input
            type="number"
            min={1}
            value={count}
            onChange={(e) => {
              const v = parseInt(e.target.value, 10);
              if (!isNaN(v) && v > 0) setCount(v);
            }}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                onConfirm(count);
                onOpenChange(false);
              }
            }}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button
            onClick={() => {
              onConfirm(count);
              onOpenChange(false);
            }}
          >
            Zuweisen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ──────────────────────────────���────────────────────────────────

interface MenueplaenePageClientProps {
  recipes: Recipe[];
  initialMenus?: InstitutionMenu[];
}

export function MenueplaenePageClient({ recipes, initialMenus }: MenueplaenePageClientProps) {
  const {
    menus,
    activeMenu,
    createMenu,
    deleteMenu,
    setMenuStatus,
    assignRecipe,
    removeRecipe,
    updatePortionCount,
    generateProductionList,
    generateShoppingList,
    isLoadingRemote,
  } = useInstitutionMenu(initialMenus, recipes);

  const [selectedWeek, setSelectedWeek] = useState(1);
  const [productionDay, setProductionDay] = useState(0);
  const [activeTab, setActiveTab] = useState<string>("planer");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<InstitutionMenu | null>(null);

  // Create form state
  const [newName, setNewName] = useState("");
  const [newCycleLength, setNewCycleLength] = useState<MenuCycleLength>(1);
  const [newStartDate, setNewStartDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [newDietFormIds, setNewDietFormIds] = useState<string[]>(["diet_vollkost"]);

  // Pending drop state (for portion dialog)
  const [pendingDrop, setPendingDrop] = useState<{
    menuId: string;
    weekNumber: number;
    dayOfWeek: number;
    dietFormId: string;
    slotType: MealSlotType;
    recipeId: string;
  } | null>(null);

  const recipeLookup = useMemo(() => createRecipeLookup(recipes), [recipes]);

  // Compute daily portion totals for the active plan
  const dailyPortionTotals = useMemo(() => {
    if (!activeMenu) return [];
    const week = activeMenu.weeks.find((w) => w.weekNumber === selectedWeek);
    if (!week) return DAY_LABELS.map(() => 0);
    return DAY_LABELS.map((_, dayIndex) => {
      const day = week.days.find((d) => d.dayOfWeek === dayIndex);
      if (!day) return 0;
      return day.dietMenus.reduce(
        (total, dm) =>
          total +
          dm.slots
            .filter((s) => VISIBLE_MEAL_SLOTS.includes(s.type))
            .reduce((sum, s) => sum + s.portionCount, 0),
        0,
      );
    });
  }, [activeMenu, selectedWeek]);

  // Production data
  const productionItems = useMemo(() => {
    if (!activeMenu) return [];
    return generateProductionList(activeMenu.id, selectedWeek, productionDay);
  }, [activeMenu, selectedWeek, productionDay, generateProductionList]);

  // Shopping data
  const shoppingItems = useMemo(() => {
    if (!activeMenu) return [];
    return generateShoppingList(activeMenu.id, selectedWeek);
  }, [activeMenu, selectedWeek, generateShoppingList]);

  const handleSlotDrop = useCallback(
    (
      menuId: string,
      weekNumber: number,
      dayOfWeek: number,
      dietFormId: string,
      slotType: MealSlotType,
      recipeId: string,
    ) => {
      setPendingDrop({
        menuId,
        weekNumber,
        dayOfWeek,
        dietFormId,
        slotType,
        recipeId,
      });
    },
    [],
  );

  const handlePortionConfirm = useCallback(
    (count: number) => {
      if (!pendingDrop) return;
      assignRecipe(
        pendingDrop.menuId,
        pendingDrop.weekNumber,
        pendingDrop.dayOfWeek,
        pendingDrop.dietFormId,
        pendingDrop.slotType,
        pendingDrop.recipeId,
        count,
      );
      setPendingDrop(null);
      toast.success("Rezept zugewiesen");
    },
    [pendingDrop, assignRecipe],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Menüplanung"
        description="Wöchentliche und zyklische Menüpläne für die Einrichtung"
        helpText="Ziehen Sie Rezepte aus der Seitenleiste in die Wochenübersicht. Sie können Portionen direkt in der Zelle anpassen oder Zuweisungen per Klick entfernen. Unter den Tabs Produktion und Einkauf werden Listen automatisch aus dem aktiven Plan generiert."
      >
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Neuer Menüplan
        </Button>
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline">
              <Utensils className="mr-2 h-4 w-4" />
              Rezeptbibliothek
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-80">
            <SheetHeader>
              <SheetTitle>Rezepte</SheetTitle>
            </SheetHeader>
            <p className="text-xs text-muted-foreground mt-1 mb-4">
              Rezepte per Drag &amp; Drop in den Plan ziehen
            </p>
            <ScrollArea className="h-[calc(100vh-140px)]">
              <div className="space-y-2 pr-3">
                {recipes.map((recipe) => (
                  <RecipeDragItem key={recipe.id} recipe={recipe} />
                ))}
              </div>
            </ScrollArea>
          </SheetContent>
        </Sheet>
        <Button
          variant="outline"
          onClick={() => toast("Druckvorschau wird vorbereitet...")}
        >
          <Printer className="mr-2 h-4 w-4" />
          Druckvorschau
        </Button>
      </PageHeader>

      {/* Sync indicator */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {isLoadingRemote ? (
          <>
            <Loader2 className="h-3 w-3 animate-spin" />
            <span>Synchronisiere…</span>
          </>
        ) : (
          <>
            <Check className="h-3 w-3" />
            <span>Gespeichert</span>
          </>
        )}
      </div>

      {/* Menu plan list */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {menus.map((menu) => {
          const statusCfg = STATUS_CONFIG[menu.status];
          return (
            <Card
              key={menu.id}
              className={
                menu.status === "active"
                  ? "border-primary/50 ring-1 ring-primary/20"
                  : ""
              }
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base">{menu.name}</CardTitle>
                  <div className="flex items-center gap-1.5">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-6 px-2">
                          <Badge variant={statusCfg.variant} className="cursor-pointer">
                            {statusCfg.label}
                          </Badge>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {(Object.entries(STATUS_CONFIG) as [InstitutionMenu["status"], typeof statusCfg][]).map(
                          ([status, cfg]) => (
                            <DropdownMenuItem
                              key={status}
                              onClick={() => setMenuStatus(menu.id, status)}
                            >
                              {cfg.label}
                            </DropdownMenuItem>
                          ),
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                    {menus.length > 1 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-muted-foreground hover:text-destructive"
                        onClick={() => setDeleteTarget(menu)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  <span>Start: {formatDate(menu.startDate)}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Utensils className="h-4 w-4" />
                  <span>
                    {menu.cycleLength === 1
                      ? "1-Wochen-Zyklus"
                      : `${menu.cycleLength}-Wochen-Zyklus`}
                  </span>
                </div>
                <div className="text-muted-foreground">
                  {menu.dietFormIds.length} Kostform
                  {menu.dietFormIds.length !== 1 ? "en" : ""}:{" "}
                  {menu.dietFormIds.map((id) => getDietFormName(id)).join(", ")}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {menus.length === 0 && (
        <Card>
          <CardContent className="py-10 text-center">
            <div className="space-y-2">
              <p className="text-sm font-medium">Noch keine Menüpläne vorhanden.</p>
              <p className="text-sm text-muted-foreground">
                Legen Sie Ihren ersten Menüplan an, um Wochenplanung, Produktion und Einkauf zu starten.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main tabbed content */}
      {activeMenu && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">{activeMenu.name}</CardTitle>
              {activeMenu.cycleLength > 1 && (
                <Select
                  value={selectedWeek.toString()}
                  onValueChange={(v) => setSelectedWeek(parseInt(v, 10))}
                >
                  <SelectTrigger className="w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {activeMenu.weeks.map((w) => (
                      <SelectItem key={w.weekNumber} value={w.weekNumber.toString()}>
                        Woche {w.weekNumber}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList>
                <TabsTrigger value="planer" className="gap-1.5">
                  <Calendar className="h-4 w-4" />
                  Wochenplan
                </TabsTrigger>
                <TabsTrigger value="produktion" className="gap-1.5">
                  <ClipboardList className="h-4 w-4" />
                  Produktion
                </TabsTrigger>
                <TabsTrigger value="einkauf" className="gap-1.5">
                  <ShoppingCart className="h-4 w-4" />
                  Einkauf
                </TabsTrigger>
              </TabsList>

              {/* ─── Wochenplan Tab ─────────���─────────────────────── */}
              <TabsContent value="planer" className="space-y-6 mt-4">
                <Tabs
                  defaultValue={activeMenu.dietFormIds[0]}
                  className="space-y-4"
                >
                  <TabsList>
                    {activeMenu.dietFormIds.map((dfId) => (
                      <TabsTrigger key={dfId} value={dfId}>
                        {getDietFormName(dfId)}
                      </TabsTrigger>
                    ))}
                  </TabsList>

                  {activeMenu.dietFormIds.map((dfId) => (
                    <TabsContent key={dfId} value={dfId}>
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="sticky left-0 z-10 bg-background min-w-[100px]">
                                Mahlzeit
                              </TableHead>
                              {DAY_LABELS.map((day) => (
                                <TableHead
                                  key={day}
                                  className="min-w-[130px] text-center"
                                >
                                  {day}
                                </TableHead>
                              ))}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {VISIBLE_MEAL_SLOTS.map((slotType) => (
                              <TableRow key={slotType}>
                                <TableCell className="sticky left-0 z-10 bg-background font-medium text-sm">
                                  {MEAL_SLOT_LABELS[slotType]}
                                </TableCell>
                                {DAY_LABELS.map((_, dayIndex) => {
                                  const week = activeMenu.weeks.find(
                                    (w) => w.weekNumber === selectedWeek,
                                  );
                                  const day = week?.days.find(
                                    (d) => d.dayOfWeek === dayIndex,
                                  );
                                  const dietMenu = day?.dietMenus.find(
                                    (dm) => dm.dietFormId === dfId,
                                  );
                                  const slot = dietMenu?.slots.find(
                                    (s) => s.type === slotType,
                                  );

                                  const recipeName = slot?.recipeId
                                    ? recipeLookup.get(slot.recipeId)?.name
                                    : undefined;

                                  return (
                                    <SlotCell
                                      key={dayIndex}
                                      recipeId={slot?.recipeId}
                                      recipeName={recipeName}
                                      portionCount={slot?.portionCount}
                                      slotType={slotType}
                                      onDrop={(recipeId) =>
                                        handleSlotDrop(
                                          activeMenu.id,
                                          selectedWeek,
                                          dayIndex,
                                          dfId,
                                          slotType,
                                          recipeId,
                                        )
                                      }
                                      onRemove={() =>
                                        removeRecipe(
                                          activeMenu.id,
                                          selectedWeek,
                                          dayIndex,
                                          dfId,
                                          slotType,
                                        )
                                      }
                                      onPortionChange={(count) =>
                                        updatePortionCount(
                                          activeMenu.id,
                                          selectedWeek,
                                          dayIndex,
                                          dfId,
                                          slotType,
                                          count,
                                        )
                                      }
                                    />
                                  );
                                })}
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </TabsContent>
                  ))}
                </Tabs>

                {/* Portion totals footer */}
                <Separator />
                <div>
                  <h3 className="text-sm font-semibold mb-3">
                    Gesamtportionen pro Tag (alle Kostformen)
                  </h3>
                  <div className="grid grid-cols-7 gap-2">
                    {DAY_LABELS.map((day, idx) => (
                      <div
                        key={day}
                        className="rounded-md border p-3 text-center"
                      >
                        <div className="text-xs text-muted-foreground font-medium">
                          {day}
                        </div>
                        <div className="text-lg font-bold mt-1">
                          {dailyPortionTotals[idx] ?? 0}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </TabsContent>

              {/* ─── Produktion Tab ────────��──────────────────────── */}
              <TabsContent value="produktion" className="mt-4">
                <div className="flex items-center gap-4 mb-4">
                  <Select
                    value={productionDay.toString()}
                    onValueChange={(v) => setProductionDay(parseInt(v, 10))}
                  >
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DAY_LABELS.map((day, idx) => (
                        <SelectItem key={idx} value={idx.toString()}>
                          {day} (Tag {idx + 1})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => toast("Druckansicht wird vorbereitet...")}
                  >
                    <Printer className="mr-1.5 h-4 w-4" />
                    Drucken
                  </Button>
                </div>
                <ProductionPanel
                  items={productionItems}
                  dayLabel={DAY_LABELS[productionDay]}
                />
              </TabsContent>

              {/* ─── Einkauf Tab ─────��────────────────────────────── */}
              <TabsContent value="einkauf" className="mt-4">
                <ShoppingPanel items={shoppingItems} />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}

      {/* Portion dialog */}
      <PortionDialog
        open={pendingDrop !== null}
        onOpenChange={(v) => {
          if (!v) setPendingDrop(null);
        }}
        onConfirm={handlePortionConfirm}
        recipeName={
          pendingDrop ? (recipeLookup.get(pendingDrop.recipeId)?.name ?? "") : ""
        }
      />

      {/* Create menu dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Neuer Menüplan</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="menu-name">Name</Label>
              <Input
                id="menu-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="z. B. Menüplan KW 20/2026"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="menu-cycle">Zykluslänge</Label>
              <Select
                value={newCycleLength.toString()}
                onValueChange={(v) =>
                  setNewCycleLength(parseInt(v, 10) as MenuCycleLength)
                }
              >
                <SelectTrigger id="menu-cycle">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 Woche</SelectItem>
                  <SelectItem value="2">2 Wochen</SelectItem>
                  <SelectItem value="4">4 Wochen</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="menu-start">Startdatum</Label>
              <Input
                id="menu-start"
                type="date"
                value={newStartDate}
                onChange={(e) => setNewStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Kostformen</Label>
              <div className="grid grid-cols-2 gap-2">
                {DIET_FORMS.filter((df) => df.isActive).map((df) => (
                  <div key={df.id} className="flex items-center gap-2">
                    <Checkbox
                      id={`df-${df.id}`}
                      checked={newDietFormIds.includes(df.id)}
                      onCheckedChange={(checked) => {
                        setNewDietFormIds((prev) =>
                          checked
                            ? [...prev, df.id]
                            : prev.filter((id) => id !== df.id),
                        );
                      }}
                    />
                    <Label
                      htmlFor={`df-${df.id}`}
                      className="text-sm font-normal cursor-pointer"
                    >
                      {df.name}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowCreateDialog(false)}
            >
              Abbrechen
            </Button>
            <Button
              disabled={!newName.trim() || newDietFormIds.length === 0}
              onClick={() => {
                createMenu({
                  name: newName.trim(),
                  cycleLength: newCycleLength,
                  startDate: newStartDate,
                  dietFormIds: newDietFormIds,
                });
                setShowCreateDialog(false);
                setNewName("");
                setNewCycleLength(1);
                setNewDietFormIds(["diet_vollkost"]);
                toast.success("Menüplan erstellt");
              }}
            >
              Erstellen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(v) => {
          if (!v) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Menüplan löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Möchten Sie den Menüplan &ldquo;{deleteTarget?.name}&rdquo;
              wirklich löschen? Diese Aktion kann nicht rückgängig gemacht
              werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteTarget) {
                  deleteMenu(deleteTarget.id);
                  toast.success("Menüplan gelöscht");
                }
                setDeleteTarget(null);
              }}
            >
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
