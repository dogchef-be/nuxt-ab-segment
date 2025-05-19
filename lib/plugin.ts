import Cookies from 'js-cookie'
import type { Plugin } from '@nuxt/types'

const COOKIE_PREFIX: string = 'abs'
const EVENT_NAME: string = '<%= options.event %>'
// eslint-disable-next-line @typescript-eslint/no-var-requires
const EXPERIMENTS: Experiment[] = require('<%= options.experiments %>')
const DEBUG: string = '<%= options.debug %>'

const REPORTED_COOKIE: string = `${COOKIE_PREFIX}_reported`

function shouldReport(reportedKey: string): boolean {
  return !getReported().includes(reportedKey)
}

function getReported(): string[] {
  const reportedCookie = toStringValue(Cookies.get(REPORTED_COOKIE))

  if (reportedCookie.length === 0) {
    return []
  }

  try {
    const reported = JSON.parse(reportedCookie)

    if (!Array.isArray(reported)) {
      return []
    }

    return reported.flatMap((item) => {
      const value = toStringValue(item)

      return value.length > 0 ? [value] : []
    })
  } catch (error) {
    return []
  }
}

function setReported(reportedKey: string): void {
  const key = toStringValue(reportedKey)

  if (key.length === 0) {
    return
  }

  const reported = getReported()

  if (!reported.includes(key)) {
    reported.push(key)
  }

  Cookies.set(REPORTED_COOKIE, JSON.stringify(reported.sort()))
}

function isExperimentArray(variants: number[] | Experiment[]): variants is Experiment[] {
  return variants.every((variant) => typeof variant !== 'number')
}

function toStringValue(value?: number | string | null, defaultValue: string = ''): string {
  if (value === null || value === undefined) {
    return defaultValue
  }

  const valueAsString = (typeof value === 'string' ? value : value.toString()).trim()

  return valueAsString.length > 0 ? valueAsString : defaultValue
}

function weightedRandom(weights: number[]): string {
  const totalWeight = weights.reduce((sum, w) => sum + w, 0)

  let random = Math.random() * totalWeight

  for (let i = 0; i < weights.length; i++) {
    if (random < weights[i]) {
      return toStringValue(i)
    }

    random -= weights[i]
  }

  return ''
}

function calculateDistribution(variants: number[] | Experiment[]): number[] {
  if (isExperimentArray(variants)) {
    const quantity = variants.length

    const base = Math.floor(100 / quantity)
    const distribution = Array.from({ length: quantity }, () => base)

    let remaining = 100 - base * quantity

    for (let i = 0; remaining > 0; i++, remaining--) {
      distribution[i]++
    }

    return distribution
  }

  return variants
}

function findExperiment(
  name: string,
  experiments: Experiment[],
  parent: Experiment | null = null
): {
  parent: Experiment | null
  variant: Variant | null
} {
  for (let i = 0; i < experiments.length; i++) {
    const exp = experiments[i]

    if (exp.name === name) {
      const variants = calculateDistribution(exp.variants)

      return {
        variant: {
          index: i,
          name: exp.name,
          weights: variants.map((weight) => {
            return weight === undefined ? 1 : weight
          }),
        },
        parent,
      }
    }

    if (isExperimentArray(exp.variants)) {
      const found = findExperiment(name, exp.variants, exp)

      if (found.variant) {
        return found
      }
    }
  }

  return { parent: null, variant: null }
}

function experimentVariant(experimentName: string, experimentOptions?: ExperimentOptions): number {
  // Return 0 if the experiment is globally disabled
  if (toStringValue(Cookies.get(`${COOKIE_PREFIX}_disabled`)) === '1') {
    return 0
  }

  const { variant, parent } = findExperiment(experimentName, EXPERIMENTS)

  // Return 0 if the experiment is not found
  if (!variant) {
    return 0
  }

  const cookieKey = `${COOKIE_PREFIX}_${experimentName}`

  // By default we always assign a variant
  const options: ExperimentOptions = Object.assign({ assignVariant: true }, experimentOptions)

  let reportVariant = options.reportVariant || false

  // Force a specific variant by url or param
  let activeVariant = toStringValue(
    window.$nuxt.$route.query[cookieKey] as string | undefined,
    toStringValue(options.forceVariant)
  )

  const hasActiveVariant = activeVariant.length > 0

  // If we have an active variant forced by url or parameter we must force the parent to the variant index
  const parentOptions: ExperimentOptions = {
    ...(hasActiveVariant ? { forceVariant: variant.index } : {}),
    reportVariant,
  }

  // If we have a parent we must first check if this test bellongs to the right split
  if (parent && experimentVariant(parent.name, parentOptions) !== variant.index) {
    reportVariant = false
    activeVariant = '0'
  }

  if (hasActiveVariant) {
    Cookies.set(cookieKey, activeVariant, { expires: variant.maxAgeDays })
  } else {
    // Determine the active variant of the experiment
    activeVariant = toStringValue(Cookies.get(cookieKey))

    if (activeVariant.length === 0) {
      // Return variant 0 if we don't want to assign a variant
      if (!options.assignVariant) {
        return 0
      }

      let retries = variant.weights.length

      while (activeVariant === '' && retries-- > 0) {
        activeVariant = weightedRandom(variant.weights)
      }

      // If the variant is still empty, return 0 and prevent further assignment
      if (activeVariant.trim().length === 0) {
        return 0
      }

      Cookies.set(cookieKey, activeVariant, { expires: variant.maxAgeDays })
    }
  }

  // Convert active variant into a number type
  const activeValue = Number.parseInt(activeVariant)

  // Return the active variant if we don't want to report it to Segment
  if (!reportVariant) {
    return activeValue
  }

  // Let Segment know about the active experiment's variant
  const reportedKey = `${experimentName}_${activeVariant}`

  if (shouldReport(reportedKey) && Boolean(window.analytics)) {
    const parameters = [
      Object.assign(
        {
          experiment: experimentName,
          variant: activeVariant,
        },
        options.segment?.properties || {}
      ),
      ...(options.segment?.options ? [options.segment.options] : []),
    ]

    if (DEBUG === 'true') {
      console.debug('[abSegment]', EVENT_NAME, '\n', ...parameters)
    }

    window.analytics.track(EVENT_NAME, ...parameters)

    setReported(reportedKey)
  }

  return activeValue
}

const abSegmentPlugin: Plugin = (_, inject): void => {
  inject('abtest', experimentVariant)
}

export default abSegmentPlugin
