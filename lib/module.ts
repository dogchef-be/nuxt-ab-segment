import chokidar from 'chokidar'
import path from 'path'
import fs from 'fs'

const getTypeDefinition = (
  experimentNames: string[]
) => `// This file is generated automatically by nuxt-ab-segment. Do not edit manually.
export {}
declare global {
  export type ExperimentName = ${experimentNames.map((name) => `'${name}'`).join(' | ')};
}
export declare function experimentVariant(experimentName: ExperimentName, experimentOptions?: ExperimentOptions): number;
declare module 'vue/types/vue' {
  interface Vue {
    $abtest: typeof experimentVariant,
  }
}
export default function AbSegmentModule(this: any): void;
`

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
    const experiments = require(experimentsPath)
    const definition = getTypeDefinition(experiments.map((exp: any) => exp.name))

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
    ssr: 'false',
    options,
  })
}
