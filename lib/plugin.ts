import Cookies from 'js-cookie'
import { Plugin } from '@nuxt/types'

const COOKIE_PREFIX: string = 'abs'
const EVENT_NAME: string = '<%= options.event %>'
// eslint-disable-next-line @typescript-eslint/no-var-requires
const EXPERIMENTS: Experiment[] = require('<%= options.experiments %>')

const reported: string[] = []

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
      return i.toString()
    }

    random -= weights[i]
  }

  return ''
}

function experimentVariant(
  experimentName: string,
  assignVariant = true,
  reportVariant = true,
  forceVariant?: number
): number {
  const experiment: Experiment | undefined = EXPERIMENTS.find((exp: Experiment) => exp.name === experimentName)
  // Return 0 if the experiment is not found or is globally disabled
  if (experiment === undefined || Cookies.get(`${COOKIE_PREFIX}_disabled`) === '1') return 0

  const cookieKey = `${COOKIE_PREFIX}_${experimentName}`

  // Force a specific variant by url or param
  const forceVariantByUrl = window.$nuxt.$route.query[cookieKey] as string | undefined

  const variant = forceVariantByUrl?.trim() ?? forceVariant?.toString()?.trim() ?? ''

  if (variant.length > 0) {
    Cookies.set(cookieKey, variant, {
      expires: experiment.maxAgeDays,
    })
  }

  // Determine the active variant of the experiment
  let activeVariant = Cookies.get(cookieKey)?.trim() ?? ''

  if (activeVariant.length === 0) {
    // Return variant 0 if we don't want to assign a variant
    if (!assignVariant) return 0

    const weights = experiment.variants.map((weight) => (weight === undefined ? 1 : weight))
    let retries = experiment.variants.length

    while (activeVariant === '' && retries-- > 0) {
      activeVariant = weightedRandom(weights)
    }

    // If the variant is still empty, return 0 and prevent further assignment
    if (activeVariant.trim().length === 0) return 0

    Cookies.set(cookieKey, activeVariant, {
      expires: experiment.maxAgeDays,
    })
  }

  // Convert active variant into a number type
  const activeValue = Number.parseInt(activeVariant)

  // Return the active variant if we don't want to report it to Segment
  if (!reportVariant) return activeValue

  // Let Segment know about the active experiment's variant
  const reportedKey = `${experimentName}_${activeVariant}`

  if (reported.indexOf(reportedKey) === -1 && window.analytics) {
    window.analytics.track(EVENT_NAME, {
      experiment: experimentName,
      variant: activeVariant,
    })

    reported.push(reportedKey)
  }

  return activeValue
}

const abSegmentPlugin: Plugin = (ctx, inject): void => {
  inject('abtest', experimentVariant)
}

export default abSegmentPlugin
