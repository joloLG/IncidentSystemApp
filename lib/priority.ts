export const PRIORITY_ORDER = ["1", "2", "3", "4"] as const

export type PriorityValue = typeof PRIORITY_ORDER[number]

export interface PriorityDetails {
  value: PriorityValue
  label: string
  description: string
  colorClass: string
}

export const PRIORITY_COLORS: Record<PriorityValue, string> = {
  "1": "bg-red-500",
  "2": "bg-yellow-400",
  "3": "bg-green-500",
  "4": "bg-gray-900",
}

export const PRIORITY_LABELS: { value: PriorityValue; label: string; description: string }[] = [
  { value: "1", label: "Priority 1", description: "Immediate (Red)" },
  { value: "2", label: "Priority 2", description: "Delayed (Yellow)" },
  { value: "3", label: "Priority 3", description: "Minor (Green)" },
  { value: "4", label: "Priority 4", description: "Expectant (Black)" },
]

const PRIORITY_DETAILS_MAP: Record<PriorityValue, PriorityDetails> = PRIORITY_ORDER.reduce((acc, value) => {
  const { label, description } = PRIORITY_LABELS.find((entry) => entry.value === value)!
  acc[value] = { value, label, description, colorClass: PRIORITY_COLORS[value] }
  return acc
}, {} as Record<PriorityValue, PriorityDetails>)

export const getPriorityDetails = (
  value: string | number | null | undefined,
): PriorityDetails | undefined => {
  if (value === null || value === undefined) return undefined
  const key = String(value) as PriorityValue
  return PRIORITY_DETAILS_MAP[key]
}
