import { ApiExportPageClient } from "./api-export-client"
import { writeAccessAuditLog } from "@/lib/audit/access-audit"
import { listApiKeys } from "@/lib/data/api-keys"
import { fetchExportJobsClient } from "@/lib/data/export-jobs"
import { createClient } from "@/lib/supabase/server"
import type { ApiKeyRecord, ExportJobRecord } from "@/lib/types"

interface ApiExportInitialData {
  exportJobs?: ExportJobRecord[]
  apiKeys?: ApiKeyRecord[]
}

async function loadInitialData(): Promise<ApiExportInitialData> {
  const authDisabled = process.env.NEXT_PUBLIC_DISABLE_AUTH_FOR_TESTING === "true"
  const authOptional =
    !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (authDisabled || authOptional) {
    return {}
  }

  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    return {}
  }

  // Fetch independently: API keys require an admin role and may be forbidden
  // while the export history is still readable. A failed fetch stays undefined
  // so the client falls back to its own request and error handling.
  const [exportJobs, apiKeys] = await Promise.all([
    fetchExportJobsClient(supabase)
      .then(async (jobs) => {
        // Match the /api/export-jobs route: reading export history is audited.
        await writeAccessAuditLog(supabase, {
          action: "export_history_accessed",
          targetType: "export_jobs",
          metadata: { resultCount: jobs.length },
        })
        return jobs
      })
      .catch((fetchError) => {
        console.warn("Failed to load initial export jobs:", fetchError)
        return undefined
      }),
    listApiKeys(supabase).catch((fetchError) => {
      console.warn("Failed to load initial API keys:", fetchError)
      return undefined
    }),
  ])

  return { exportJobs, apiKeys }
}

export default async function ApiExportPage() {
  const initialData = await loadInitialData()

  return (
    <ApiExportPageClient
      initialExportJobs={initialData.exportJobs}
      initialApiKeys={initialData.apiKeys}
    />
  )
}
