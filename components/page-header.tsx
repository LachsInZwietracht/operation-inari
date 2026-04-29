"use client"

import { Info } from "lucide-react"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface PageHeaderProps {
  title: string
  description?: string
  helpText?: string
  children?: React.ReactNode
}

export function PageHeader({ title, description, helpText, children }: PageHeaderProps) {
  return (
    <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 space-y-1">
        <div className="flex min-w-0 items-center gap-2">
          <h1 className="min-w-0 break-words text-2xl font-bold tracking-tight">{title}</h1>
          {helpText && (
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="text-muted-foreground hover:text-foreground cursor-pointer"
                  aria-label="Hilfe"
                >
                  <Info className="h-4 w-4" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-72 text-sm">
                {helpText}
              </PopoverContent>
            </Popover>
          )}
        </div>
        {description && (
          <p className="text-muted-foreground max-w-prose text-sm">{description}</p>
        )}
      </div>
      {children && <div className="flex w-full min-w-0 flex-wrap items-center gap-2 sm:w-auto sm:justify-end">{children}</div>}
    </div>
  )
}
