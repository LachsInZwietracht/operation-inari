import { Progress } from "@/components/ui/progress"
import { formatNutrient, formatPercent } from "@/lib/format"

interface NutrientBarProps {
  label: string
  value: number
  unit: string
  referenceValue: number
  color?: string
}

export function NutrientBar({ label, value, unit, referenceValue, color }: NutrientBarProps) {
  const percentage = referenceValue > 0 ? (value / referenceValue) * 100 : 0
  const clampedPercentage = Math.min(percentage, 100)

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground">{formatNutrient(value, unit)}</span>
      </div>
      <div className="flex items-center gap-2">
        <Progress
          value={clampedPercentage}
          className="h-2 flex-1"
          style={color ? { ["--progress-color" as string]: color } : undefined}
        />
        <span className="text-muted-foreground w-14 text-right text-xs">
          {formatPercent(percentage)}
        </span>
      </div>
    </div>
  )
}
