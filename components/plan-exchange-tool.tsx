"use client"

import Link from "next/link"
import { ArrowLeftRight, ArrowUpRight } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

/** Tools card: bridges the planner to the standalone Austauschtabellen page. */
export function PlanExchangeTool() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <ArrowLeftRight className="text-primary h-4 w-4" />
          Lebensmittel-Austausch
        </CardTitle>
        <CardDescription>
          Passende Alternativen aus den Austauschtabellen finden.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button asChild variant="outline" size="sm">
          <Link href="/austauschtabellen">
            Austauschtabellen öffnen
            <ArrowUpRight className="ml-1.5 h-4 w-4" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  )
}
