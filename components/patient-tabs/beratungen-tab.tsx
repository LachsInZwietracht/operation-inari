"use client"

import Link from "next/link"
import { Plus } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatDate } from "@/lib/format"
import type { CounselingSession, Patient } from "@/lib/types"

interface BeratungenTabProps {
  patient: Patient
  sessions: CounselingSession[]
  counselingPending: boolean
}

export function BeratungenTab({ patient, sessions, counselingPending }: BeratungenTabProps) {
  return (
    <>
      <div className="flex justify-end">
        <Button asChild>
          <Link href={`/patienten/${patient.id}/beratungen/neu`}>
            <Plus className="mr-2 h-4 w-4" />
            Neue Beratung
          </Link>
        </Button>
      </div>

      {sessions.length > 0 ? (
        <div className="grid gap-4">
          {sessions
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
            .map((session) => (
              <Link
                key={session.id}
                href={`/patienten/${patient.id}/beratungen/${session.id}`}
              >
                <Card className="transition-colors hover:bg-muted/50">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-base">
                        {session.type} – {session.indication}
                      </CardTitle>
                      <Badge variant="outline">{session.duration} Min.</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground">
                    <p>{formatDate(session.date)}</p>
                    {session.goals && (
                      <p className="mt-1 line-clamp-1">{session.goals}</p>
                    )}
                  </CardContent>
                </Card>
              </Link>
            ))}
        </div>
      ) : counselingPending ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Beratungssitzungen werden synchronisiert.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Noch keine Beratungssitzungen vorhanden.
          </CardContent>
        </Card>
      )}
    </>
  )
}
