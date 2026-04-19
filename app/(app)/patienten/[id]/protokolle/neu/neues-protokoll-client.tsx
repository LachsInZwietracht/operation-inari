"use client"

import { use, useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { PageHeader } from "@/components/page-header"
import { ProtocolForm } from "@/components/protocol-form"
import { useProtocols } from "@/hooks/use-protocols"
import { usePatients } from "@/hooks/use-patients"
import { useFoods } from "@/components/foods-provider"
import { useDigitalProtocolSubmissions } from "@/hooks/use-digital-protocol-submissions"
import { buildProtocolDraftFromSubmission } from "@/lib/digital-protocol-conversion"
import { Button } from "@/components/ui/button"
import type { DigitalProtocolSubmission, NutritionProtocol } from "@/lib/types"

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function NeuesProtokollPageClient({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const searchParams = useSearchParams()
  const templateId = searchParams.get("template") ?? undefined
  const digitalSubmissionId = searchParams.get("digitalSubmission") ?? undefined
  const { getPatient } = usePatients()
  const foods = useFoods()
  const { addProtocol } = useProtocols(foods)
  const { isLoading, getSubmission, loadSubmission, markConverted } = useDigitalProtocolSubmissions(id)
  const patient = getPatient(id)
  const [resolvedSubmission, setResolvedSubmission] = useState<DigitalProtocolSubmission | null | undefined>(
    digitalSubmissionId ? undefined : null,
  )

  useEffect(() => {
    if (!digitalSubmissionId) {
      setResolvedSubmission(null)
      return
    }

    const existingSubmission = getSubmission(digitalSubmissionId)
    if (existingSubmission) {
      setResolvedSubmission(existingSubmission)
      return
    }

    let cancelled = false
    void loadSubmission(digitalSubmissionId).then((submission) => {
      if (!cancelled) {
        setResolvedSubmission(submission)
      }
    })

    return () => {
      cancelled = true
    }
  }, [digitalSubmissionId, getSubmission, loadSubmission])

  const initialValues = useMemo(
    () => (resolvedSubmission ? buildProtocolDraftFromSubmission(resolvedSubmission, foods) : undefined),
    [foods, resolvedSubmission],
  )

  const handleSubmit = useCallback(
    async (protocol: Omit<NutritionProtocol, "id" | "createdAt" | "updatedAt">) => {
      const createdProtocol = await addProtocol(protocol)

      if (resolvedSubmission) {
        if (!UUID_REGEX.test(createdProtocol.id)) {
          throw new Error("Das uebernommene Protokoll konnte nicht serverseitig gespeichert werden.")
        }

        await markConverted(resolvedSubmission.id, createdProtocol.id)
      }

      return createdProtocol
    },
    [addProtocol, markConverted, resolvedSubmission],
  )

  if (!patient) {
    return (
      <div className="space-y-6">
        <PageHeader title="Patient nicht gefunden" />
      </div>
    )
  }

  if (digitalSubmissionId && (isLoading || resolvedSubmission === undefined)) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Digitales Protokoll wird vorbereitet"
          description={`${patient.firstName} ${patient.lastName}`}
        />
        <p className="text-sm text-muted-foreground">
          Die eingereichte Protokoll-Einreichung wird geladen und als Entwurf vorbereitet.
        </p>
      </div>
    )
  }

  if (digitalSubmissionId && !resolvedSubmission) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Einreichung nicht gefunden"
          description={`${patient.firstName} ${patient.lastName}`}
        />
        <p className="text-sm text-muted-foreground">
          Die angeforderte digitale Einreichung konnte nicht geladen werden.
        </p>
      </div>
    )
  }

  if (resolvedSubmission && resolvedSubmission.patientId !== id) {
    return (
      <div className="space-y-6">
        <PageHeader title="Einreichung passt nicht zum Patienten" />
        <p className="text-sm text-muted-foreground">
          Diese digitale Einreichung gehoert zu einem anderen Patienten.
        </p>
      </div>
    )
  }

  if (resolvedSubmission?.status === "converted" && resolvedSubmission.convertedProtocolId) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Einreichung bereits uebernommen"
          description={`${patient.firstName} ${patient.lastName}`}
        />
        <p className="text-sm text-muted-foreground">
          Diese digitale Einreichung wurde bereits in ein internes Protokoll uebernommen.
        </p>
        <div className="flex gap-3">
          <Button asChild>
            <Link href={`/patienten/${id}/protokolle/${resolvedSubmission.convertedProtocolId}`}>
              Protokoll oeffnen
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href={`/patienten/${id}`}>Zurueck zum Patienten</Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={resolvedSubmission ? "Digitales Protokoll uebernehmen" : "Neues Ernährungsprotokoll"}
        description={`${patient.firstName} ${patient.lastName}`}
      />
      <ProtocolForm
        patientId={id}
        templateId={resolvedSubmission ? undefined : templateId}
        initialValues={initialValues}
        getSuccessRedirectPath={
          resolvedSubmission
            ? (protocol) => `/patienten/${id}/protokolle/${protocol.id}`
            : undefined
        }
        onSubmit={handleSubmit}
      />
    </div>
  )
}
