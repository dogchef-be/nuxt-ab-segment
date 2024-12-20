import Cookies from 'js-cookie'
import { Plugin } from '@nuxt/types'

const COOKIE_PREFIX: string = 'abs'
const EVENT_NAME: string = '<%= options.event %>'
// eslint-disable-next-line @typescript-eslint/no-var-requires
const EXPERIMENTS: Experiment[] = require('<%= options.experiments %>')
const DEBUG: string = '<%= options.debug %>'

const reported: string[] = []

function toStringValue(value?: number | string | null, defaultValue: string = ''): string {
  if (value === null || value === undefined) {
    return defaultValue
  }

  const valueAsString = (typeof value === 'string' ? value : value.toString()).trim()

  return valueAsString.length > 0 ? valueAsString : defaultValue
}

function weightedRandom(weights: number[]): string {
  let totalWeight = 0,
    i,
    random

  for (i = 0; i < weights.length; i++) {
    totalWeight += weights[i]
  }

  random = Math.random() * totalWeight

  for (i = 0; i < weights.length; i++) {
    if (random < weights[i]) {
      return toStringValue(i)
    }

    random -= weights[i]
  }

  return ''
}

function experimentVariant(experimentName: string, experimentOptions?: ExperimentOptions): number {
  // Return 0 if the experiment is globally disabled
  if (toStringValue(Cookies.get(`${COOKIE_PREFIX}_disabled`)) === '1') {
    return 0
  }

  const experiment: Experiment | undefined = EXPERIMENTS.find((exp: Experiment) => exp.name === experimentName)

  // Return 0 if the experiment is not found
  if (!experiment) {
    return 0
  }

  const cookieKey = `${COOKIE_PREFIX}_${experimentName}`

  // By default we always assign a variant
  const options: ExperimentOptions = Object.assign({ assignVariant: true }, experimentOptions)

  // Force a specific variant by url or param
  const forceVariantByUrl = window.$nuxt.$route.query[cookieKey] as string | undefined

  let activeVariant = toStringValue(forceVariantByUrl, toStringValue(options.forceVariant))

  if (activeVariant.length > 0) {
    Cookies.set(cookieKey, activeVariant, {
      expires: experiment.maxAgeDays,
    })
  } else {
    // Determine the active variant of the experiment
    activeVariant = toStringValue(Cookies.get(cookieKey))

    if (activeVariant.length === 0) {
      // Return variant 0 if we don't want to assign a variant
      if (!options.assignVariant) {
        return 0
      }

      const weights = experiment.variants.map((weight) => (weight === undefined ? 1 : weight))
      let retries = experiment.variants.length

      while (activeVariant === '' && retries-- > 0) {
        activeVariant = weightedRandom(weights)
      }

      // If the variant is still empty, return 0 and prevent further assignment
      if (activeVariant.trim().length === 0) {
        return 0
      }

      Cookies.set(cookieKey, activeVariant, {
        expires: experiment.maxAgeDays,
      })
    }
  }

  // Convert active variant into a number type
  const activeValue = Number.parseInt(activeVariant)

  // Return the active variant if we don't want to report it to Segment
  if (!options.reportVariant) {
    return activeValue
  }

  // Let Segment know about the active experiment's variant
  const reportedKey = `${experimentName}_${activeVariant}`

  if (reported.indexOf(reportedKey) === -1 && window.analytics) {
    const properties = Object.assign(
      {
        experiment: experimentName,
        variant: activeVariant,
      },
      options.segment?.properties ?? {}
    )

    if (DEBUG === 'true') {
      console.debug('[abSegment]', EVENT_NAME, '\n', properties, options.segment?.options)
    }

    window.analytics.track(EVENT_NAME, properties, options.segment?.options)

    reported.push(reportedKey)
  }

  return activeValue
}

const abSegmentPlugin: Plugin = (_, inject): void => {
  inject('abtest', experimentVariant)
}

export default abSegmentPlugin
