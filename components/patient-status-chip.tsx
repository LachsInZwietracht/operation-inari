import { PATIENT_STATUS_META, type PatientPipelineStatus } from "@/lib/patient-status"
import { cn } from "@/lib/utils"

interface PatientStatusChipProps {
  status: PatientPipelineStatus
  className?: string
}

/**
 * The pipeline state as words plus a dot.
 *
 * The label carries the meaning on purpose — colour alone fails for colour-blind
 * users and disappears in print and greyscale exports, both of which matter in a
 * clinical setting.
 */
export function PatientStatusChip({ status, className }: PatientStatusChipProps) {
  const meta = PATIENT_STATUS_META[status]

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium",
        className,
      )}
      title={meta.description}
    >
      <span className={cn("size-1.5 rounded-full", meta.dotClassName)} aria-hidden="true" />
      {meta.label}
    </span>
  )
}
