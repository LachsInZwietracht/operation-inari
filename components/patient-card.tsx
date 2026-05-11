import Link from "next/link"
import { Calendar, MapPin, Stethoscope } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { formatDate } from "@/lib/format"
import type { Patient } from "@/lib/types"

interface PatientCardProps {
  patient: Patient
  lastSessionDate?: string
}

export function PatientCard({ patient, lastSessionDate }: PatientCardProps) {
  return (
    <Link href={`/patienten/${patient.id}`} data-patient-id={patient.id}>
      <Card className="transition-colors hover:bg-muted/50">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-base">
              {patient.lastName}, {patient.firstName}
            </CardTitle>
            {patient.indications && patient.indications.length > 0 && (
              <div className="flex flex-wrap justify-end gap-1">
                {patient.indications.map((indication) => (
                  <Badge key={indication} variant="secondary" className="text-xs">
                    {indication}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-1.5 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Calendar className="h-3.5 w-3.5" />
            <span>geb. {formatDate(patient.dateOfBirth)}</span>
          </div>
          {patient.city && (
            <div className="flex items-center gap-2">
              <MapPin className="h-3.5 w-3.5" />
              <span>{patient.city}</span>
            </div>
          )}
          {lastSessionDate && (
            <div className="flex items-center gap-2">
              <Stethoscope className="h-3.5 w-3.5" />
              <span>Letzte Beratung: {formatDate(lastSessionDate)}</span>
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  )
}
