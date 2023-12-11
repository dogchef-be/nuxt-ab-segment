import path from 'path'
import { experimentVariant } from './plugin'

declare module 'vue/types/vue' {
  interface Vue {
    $abtest: typeof experimentVariant
  }
}

// eslint-disable-next-line
export default function AbSegmentModule(this: any): void {
  const defaults = {
    event: 'AB Test',
    experiments: '~/experiments.js',
  }

  const options = Object.assign({}, defaults, this.options.abSegment)

  this.addPlugin({
    src: path.resolve(__dirname, 'plugin.js'),
    ssr: 'false',
    options,
  })
}
