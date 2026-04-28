"use client"

import { useCallback, useEffect, useState } from "react"

import type { PatientReportRecord, PatientReportVersion } from "@/lib/types"
import {
  fetchPatientReportByIdClient,
  fetchPatientReportVersionByIdClient,
  fetchPatientReportsClient,
} from "@/lib/data/patient-reports-client"
import { useAuth } from "@/hooks/use-auth"

interface UsePatientReportsOptions {
  initialReports?: PatientReportRecord[]
}

export function usePatientReports(
  patientRef?: string,
  options: UsePatientReportsOptions = {},
) {
  const { isAuthenticated, loading: authLoading } = useAuth()
  const [reports, setReports] = useState<PatientReportRecord[]>(options.initialReports ?? [])
  const [isLoading, setIsLoading] = useState(false)

  const refresh = useCallback(async () => {
    if (!isAuthenticated) {
      setReports([])
      return
    }

    setIsLoading(true)
    try {
      const data = await fetchPatientReportsClient(patientRef)
      setReports(data)
    } catch (error) {
      console.error("Failed to fetch patient reports:", error)
    } finally {
      setIsLoading(false)
    }
  }, [isAuthenticated, patientRef])

  useEffect(() => {
    if (!isAuthenticated || authLoading) return
    if (options.initialReports) return
    void refresh()
  }, [authLoading, isAuthenticated, options.initialReports, refresh])

  const getReport = useCallback(
    (reportId: string) => reports.find((report) => report.id === reportId),
    [reports],
  )

  const loadReport = useCallback(
    async (reportId: string) => {
      if (!isAuthenticated) return null
      try {
        return await fetchPatientReportByIdClient(reportId)
      } catch (error) {
        console.error("Failed to load patient report:", error)
        return null
      }
    },
    [isAuthenticated],
  )

  const getVersion = useCallback(
    (versionId: string): PatientReportVersion | undefined =>
      reports.flatMap((report) => report.versions ?? []).find((version) => version.id === versionId),
    [reports],
  )

  const loadVersion = useCallback(
    async (versionId: string) => {
      if (!isAuthenticated) return null
      try {
        return await fetchPatientReportVersionByIdClient(versionId)
      } catch (error) {
        console.error("Failed to load patient report version:", error)
        return null
      }
    },
    [isAuthenticated],
  )

  return {
    reports,
    isLoading,
    refresh,
    getReport,
    loadReport,
    getVersion,
    loadVersion,
  }
}
