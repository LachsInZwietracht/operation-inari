"use client"

import { useEffect } from "react"
import Link from "next/link"
import { RefreshCw } from "lucide-react"

import { Button } from "@/components/ui/button"

/**
 * Error boundary for the whole counselor app.
 *
 * It sits inside the shell, so the sidebar and the command palette stay usable
 * and the practitioner can navigate away instead of meeting a blank page. The
 * underlying message is deliberately not shown — it is a Postgres or Supabase
 * string, which tells a dietitian nothing and can name internal columns.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("Route error:", error)
  }, [error])

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <div className="space-y-1.5">
        <h1 className="text-[15px] font-medium">Diese Seite konnte nicht geladen werden</h1>
        <p className="max-w-md text-[13px] text-muted-foreground">
          Die Daten sind nicht angekommen. Nichts ist verloren gegangen — versuch es noch
          einmal, oder geh zurück zur Übersicht.
        </p>
        {error.digest ? (
          <p className="pt-1 font-mono text-[11px] text-fg-3">Referenz: {error.digest}</p>
        ) : null}
      </div>

      <div className="flex flex-wrap justify-center gap-2">
        <Button size="sm" onClick={reset}>
          <RefreshCw className="mr-1.5 size-3.5" />
          Erneut versuchen
        </Button>
        <Button size="sm" variant="outline" asChild>
          <Link href="/dashboard">Zum Dashboard</Link>
        </Button>
      </div>
    </div>
  )
}
