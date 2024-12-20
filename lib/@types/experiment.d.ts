interface Experiment {
  name: string
  maxAgeDays: number
  variants: number[]
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
