import chokidar from 'chokidar'
import fs from 'fs'
import path from 'path'

function flatExperimentNames(experiments: Experiment[]): string[] {
  return experiments.reduce<string[]>((acc, exp) => {
    if (exp.variants.every((v) => typeof v !== 'number')) {
      acc.push(...flatExperimentNames(exp.variants))
    } else {
      acc.push(`'${exp.name}'`)
    }

    return acc
  }, [])
}

function generateTypeDefinition(experiments: Experiment[]): string {
  return (
    `// This file is generated automatically by nuxt-ab-segment. Do not edit manually.\n` +
    `export {}\n` +
    `export type ExperimentName = ${flatExperimentNames(experiments).join(' | ')};\n` +
    `export interface Experiment {\n` +
    `  name: ExperimentName\n` +
    `  variants: number[] | Experiment[]\n` +
    `  maxAgeDays?: number\n` +
    `}\n` +
    `export interface ExperimentOptions {\n` +
    `  assignVariant?: boolean\n` +
    `  reportVariant?: boolean\n` +
    `  forceVariant?: number\n` +
    `  segment?: {\n` +
    `    options?: SegmentAnalytics.SegmentOpts\n` +
    `    properties?: unknown\n` +
    `  }\n` +
    `}\n` +
    `export declare function experimentVariant(experimentName: ExperimentName, experimentOptions?: ExperimentOptions): number;\n` +
    `declare module 'vue/types/vue' {\n` +
    `  interface Vue {\n` +
    `    $abtest: typeof experimentVariant,\n` +
    `  }\n` +
    `}\n` +
    `export default function AbSegmentModule(this: any): void;\n`
  )
}

// eslint-disable-next-line
export default function AbSegmentModule(this: any): void {
  const defaults = {
    event: 'AB Test',
    experiments: '~/experiments.js',
    debug: process.env.NODE_ENV !== 'production',
  }

  const options = Object.assign({}, defaults, this.options.abSegment)
  const experimentsPath = this.nuxt.resolver.resolveAlias(options.experiments)

  const dtsPath = path.resolve(__dirname, 'module.d.ts')

  const regenerateDts = (clearRequireCache: boolean) => {
    if (!fs.existsSync(experimentsPath)) {
      throw new Error(`[ABSegment] Experiments file not found at: ${experimentsPath}`)
    }

    if (clearRequireCache) {
      delete require.cache[require.resolve(experimentsPath)]
    }

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const experiments: Experiment[] = require(experimentsPath)
    const definition = generateTypeDefinition(experiments)

    if (!fs.existsSync(path.dirname(dtsPath))) {
      fs.mkdirSync(path.dirname(dtsPath), { recursive: true })
    }

    fs.writeFileSync(dtsPath, definition)
  }

  this.nuxt.hook('build:before', () => regenerateDts(false))

  if (this.options.dev) {
    const watcher = chokidar.watch(experimentsPath, { ignoreInitial: true })

    watcher.on('change', () => regenerateDts(true))

    this.nuxt.hook('close', () => watcher.close())
  }

  this.addPlugin({
    src: path.resolve(__dirname, 'plugin.js'),
    mode: 'client',
    ssr: 'false',
    options,
  })
}
