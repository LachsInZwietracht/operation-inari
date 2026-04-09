"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { Plus, Search } from "lucide-react"
import { PageHeader } from "@/components/page-header"
import { PatientCard } from "@/components/patient-card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { usePatients } from "@/hooks/use-patients"
import { COUNSELING_SESSIONS } from "@/lib/mock-data"
import { INDICATION_OPTIONS } from "@/lib/constants"

export default function PatientenPage() {
  const { patients } = usePatients()
  const [search, setSearch] = useState("")
  const [indicationFilter, setIndicationFilter] = useState<string>("alle")

  const lastSessionMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const session of COUNSELING_SESSIONS) {
      const existing = map.get(session.patientId)
      if (!existing || session.date > existing) {
        map.set(session.patientId, session.date)
      }
    }
    return map
  }, [])

  const filtered = useMemo(() => {
    return patients.filter((p) => {
      const matchesSearch =
        !search ||
        `${p.firstName} ${p.lastName}`.toLowerCase().includes(search.toLowerCase()) ||
        `${p.lastName} ${p.firstName}`.toLowerCase().includes(search.toLowerCase())
      const matchesIndication =
        indicationFilter === "alle" || p.indication === indicationFilter
      return matchesSearch && matchesIndication
    })
  }, [patients, search, indicationFilter])

  return (
    <div className="space-y-6">
      <PageHeader title="Patienten" description="Patientenverwaltung und -übersicht">
        <Button asChild>
          <Link href="/patienten/neu">
            <Plus className="mr-2 h-4 w-4" />
            Neuer Patient
          </Link>
        </Button>
      </PageHeader>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Patient suchen..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={indicationFilter} onValueChange={setIndicationFilter}>
          <SelectTrigger className="w-full sm:w-[220px]">
            <SelectValue placeholder="Alle Indikationen" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="alle">Alle Indikationen</SelectItem>
            {INDICATION_OPTIONS.map((ind) => (
              <SelectItem key={ind} value={ind}>
                {ind}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filtered.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((patient) => (
            <PatientCard
              key={patient.id}
              patient={patient}
              lastSessionDate={lastSessionMap.get(patient.id)}
            />
          ))}
        </div>
      ) : (
        <div className="py-10 text-center text-sm text-muted-foreground">
          Keine Patienten gefunden.
        </div>
      )}
    </div>
  )
}
