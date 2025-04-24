interface Variant {
  name: string
  index: number
  weights: number[]
  maxAgeDays?: number
}

interface Experiment {
  name: string
  variants: number[] | Experiment[]
  maxAgeDays?: number
}

interface ExperimentOptions {
  assignVariant?: boolean
  reportVariant?: boolean
  forceVariant?: number
  segment?: {
    options?: SegmentAnalytics.SegmentOpts
    properties?: unknown
  }
}
