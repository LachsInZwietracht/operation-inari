import {
  INTAKE_STAGE_META,
  INTAKE_STAGE_ORDER,
  stageProgress,
  type IntakeStage,
} from "@/lib/patient-journey"

interface IntakeStageProgressProps {
  stage: IntakeStage
}

/**
 * Four 3px segments showing how far along the intake this person is.
 *
 * Completed segments carry the stage colour, open ones the track colour. It is
 * a progress reading, not a second status badge — the same information as the
 * group it sits in, said in a way you can take in without reading.
 */
export function IntakeStageProgress({ stage }: IntakeStageProgressProps) {
  const completed = stageProgress(stage)
  const meta = INTAKE_STAGE_META[stage]

  return (
    <div
      className="flex items-center gap-1"
      role="img"
      aria-label={`Stufe ${completed} von ${INTAKE_STAGE_ORDER.length}: ${meta.label}`}
    >
      {INTAKE_STAGE_ORDER.map((_, index) => (
        <span
          key={index}
          className="h-[3px] w-5 rounded-full"
          style={{
            backgroundColor: index < completed ? meta.color : "var(--track)",
          }}
        />
      ))}
    </div>
  )
}
