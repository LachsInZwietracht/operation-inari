"use client"

import { ChevronDown, Plus, X } from "lucide-react"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

export interface ListViewOption {
  value: string
  label: string
}

export interface FilterValueOption {
  value: string
  label: string
}

export interface FilterFieldDefinition {
  /** Query-parameter key this field writes to, e.g. "stufe". */
  field: string
  /** Practitioner-facing field name shown in the chip, e.g. "Stufe". */
  label: string
  /** Relation shown between field and value. Defaults to "ist". */
  operator?: string
  options: FilterValueOption[]
}

export interface ActiveListFilter {
  field: string
  label: string
  operator: string
  value: string
  valueLabel: string
}

export interface ListSelectOption {
  value: string
  label: string
}

interface ListFilterBarProps {
  views: ListViewOption[]
  view: string
  onViewChange: (view: string) => void
  filterFields?: FilterFieldDefinition[]
  filters?: ActiveListFilter[]
  onAddFilter?: (filter: ActiveListFilter) => void
  onRemoveFilter?: (field: string) => void
  groupOptions?: ListSelectOption[]
  group?: string
  onGroupChange?: (group: string) => void
  sortOptions?: ListSelectOption[]
  sort?: string
  onSortChange?: (sort: string) => void
}

/**
 * The app-wide filter bar: view switcher, filters, grouping and sorting.
 *
 * Pairs with {@link PageBreadcrumb} directly above it — same 18px inset, same
 * bottom rule — so the two read as one header block on every list page.
 *
 * The bar is presentation only. It reports changes upward and never owns state,
 * because view and filters belong in the URL: a practitioner who filters down to
 * "Fragebogen zurück", opens a patient and hits back must land on the same list,
 * and must be able to paste that list to a colleague.
 */
export function ListFilterBar({
  views,
  view,
  onViewChange,
  filterFields = [],
  filters = [],
  onAddFilter,
  onRemoveFilter,
  groupOptions,
  group,
  onGroupChange,
  sortOptions,
  sort,
  onSortChange,
}: ListFilterBarProps) {
  const canFilter = filterFields.length > 0 && Boolean(onAddFilter)

  return (
    <div className="flex h-11 shrink-0 items-center gap-2 overflow-x-auto border-b px-[18px]">
      <div
        className="flex shrink-0 items-center gap-0.5 rounded-md bg-chip p-0.5"
        role="tablist"
        aria-label="Ansicht"
      >
        {views.map((option) => {
          const isActive = option.value === view

          return (
            <button
              key={option.value}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onViewChange(option.value)}
              className={cn(
                "h-7 rounded-md px-2.5 text-[12.5px] transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-muted-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                isActive
                  ? "bg-btn font-medium text-foreground"
                  : "text-fg-3 hover:text-foreground",
              )}
            >
              {option.label}
            </button>
          )
        })}
      </div>

      {canFilter ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex h-7 shrink-0 items-center gap-1 rounded-md border border-dashed px-2 text-[12.5px] text-fg-3 transition-colors hover:bg-row-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-muted-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <Plus className="size-3" aria-hidden="true" />
              Filter
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48">
            {filterFields.map((field) => (
              <DropdownMenuSub key={field.field}>
                <DropdownMenuSubTrigger className="text-[13px]">
                  {field.label}
                </DropdownMenuSubTrigger>
                <DropdownMenuPortal>
                  <DropdownMenuSubContent className="w-52">
                    {field.options.map((option) => (
                      <DropdownMenuItem
                        key={option.value}
                        className="text-[13px]"
                        onSelect={() =>
                          onAddFilter?.({
                            field: field.field,
                            label: field.label,
                            operator: field.operator ?? "ist",
                            value: option.value,
                            valueLabel: option.label,
                          })
                        }
                      >
                        {option.label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuPortal>
              </DropdownMenuSub>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}

      {filters.map((filter) => (
        <span
          key={filter.field}
          className="flex h-7 shrink-0 items-center gap-1.5 rounded-md bg-chip pl-2 pr-1 text-[12.5px]"
        >
          <span className="text-fg-3">{filter.label}</span>
          <span className="text-fg-4">·</span>
          <span className="text-fg-3">{filter.operator}</span>
          <span className="text-fg-4">·</span>
          <span className="font-medium text-foreground">{filter.valueLabel}</span>
          <button
            type="button"
            onClick={() => onRemoveFilter?.(filter.field)}
            aria-label={`Filter ${filter.label} entfernen`}
            className="flex size-5 items-center justify-center rounded text-fg-3 transition-colors hover:bg-row-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-muted-foreground"
          >
            <X className="size-3" aria-hidden="true" />
          </button>
        </span>
      ))}

      <div className="ml-auto flex shrink-0 items-center gap-1">
        <ListFilterBarSelect
          srLabel="Gruppierung"
          prefix="Gruppierung"
          options={groupOptions}
          value={group}
          onChange={onGroupChange}
        />
        <ListFilterBarSelect
          srLabel="Sortierung"
          prefix="Sortierung"
          options={sortOptions}
          value={sort}
          onChange={onSortChange}
        />
      </div>
    </div>
  )
}

interface ListFilterBarSelectProps {
  srLabel: string
  prefix: string
  options?: ListSelectOption[]
  value?: string
  onChange?: (value: string) => void
}

function ListFilterBarSelect({
  srLabel,
  prefix,
  options,
  value,
  onChange,
}: ListFilterBarSelectProps) {
  if (!options?.length || !onChange) return null

  const selected = options.find((option) => option.value === value) ?? options[0]

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`${srLabel}: ${selected.label}`}
          className="flex h-7 items-center gap-1 rounded-md px-2 text-[12.5px] text-fg-3 transition-colors hover:bg-row-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-muted-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <span className="hidden sm:inline">{prefix}</span>
          <span className="font-medium text-foreground">{selected.label}</span>
          <ChevronDown className="size-3" aria-hidden="true" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        {options.map((option) => (
          <DropdownMenuItem
            key={option.value}
            className="text-[13px]"
            onSelect={() => onChange(option.value)}
          >
            {option.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
