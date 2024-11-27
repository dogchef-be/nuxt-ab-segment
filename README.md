<h1 align="center">
  nuxt-ab-segment
</h1>
<p align="center">
  NuxtJS module for A/B testing with Segment Analytics<br />
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/nuxt-ab-segment"><img src="https://img.shields.io/npm/v/nuxt-ab-segment?style=flat-square"></a> <a href="https://www.npmjs.com/package/nuxt-ab-segment"><img src="https://img.shields.io/npm/dt/nuxt-ab-segment?style=flat-square"></a> <a href="#"><img src="https://img.shields.io/github/license/dogchef-be/nuxt-ab-segment?style=flat-square"></a>
</p>
<br />

## Table of contents

- [Main features](#main-features)
- [Dependencies](#dependencies)
- [Setup](#setup)
- [Options](#options)
- [Usage](#usage)
- [Credits](#credits)
- [License](#license)

## Main features

- Run multiple experiments simultaneously
- TypeScript support
- Cookies to persist variants across users
- Force a specific variant via url or param. E.g. `url?abs_experiment-x=1` or `this.$abtest('experiment-x', true, true, 1);`
- Prevent automatic reporting of a/b test analytics. E.g. `this.$abtest('experiment-x', true, false);`
- Avoid activating the a/b test anywhere. E.g. `this.$abtest('experiment-x', false);`
- Disable all a/b tests by cookie (`abs_disabled=1`), which is useful for E2E tests in CI/CD pipelines

## Dependencies

- [nuxt-segment](https://github.com/dansmaculotte/nuxt-segment)
- Or any other alternative to inject [Segment Analytics](https://segment.com)

## Setup

1. Add `nuxt-ab-segment` dependency to your project:

```bash
npm install nuxt-ab-segment
```

2. Add `nuxt-ab-segment` module and configuration to `nuxt.config.js`:

```js
export default {
  // ...other config options
  modules: ["nuxt-ab-segment"];
  abSegment: {
    event: "AB Test", // optional
    experiments: '~/experiments.js', // optional
    debug: process.env.NODE_ENV !== 'production', // optional
  }
}
```

3. Create the `experiments.js` in project's root with an array of your experiments. An example:

```js
/**
 * {
 *  name: string; A name to identify the experiment on this.$abtest('NAME_HERE')
 *  maxAgeDays: number; Number of days to persist the cookie of user's active variant
 *  variants: number[]; An array of variants weights
 * }
 */
module.exports = [
  {
    name: "experiment-x",
    maxAgeDays: 15,
    variants: [50, 50],
  },
];
```

4. (Optional) TypeScript support. Add `nuxt-ab-segment` to the `types` section of `tsconfig.json`:

```json
{
  "compilerOptions": {
    "types": ["nuxt-ab-segment"]
  }
}
```

## Options

### `event`

- Type: `String`
- Default: `AB Test`

Event name reported to Segment.

### `experiments`

- Type: `String`
- Default: `~/experiments.js`

File path for your experiments definition.

### `debug`

- Type: `Boolean`
- Default:
  - Development: `true`
  - Production: `false`

Enables or disables printing Segment reports to the console.

## Usage

It can be used inside components like:

```js
{
  data: () => ({
    payBtnLabel: null as string | null,
  }),
  mounted() {
    // Scenario: Determine an experiment variant and then display a label depending on it.
    const expA = this.$abtest('experiment-a');
    if (expA === 0) {
      this.payBtnLabel = 'Place order';
    } else {
      this.payBtnLabel = 'Pay now!';
    }

    // Scenario: We want to force a specific variant programmatically.
    const expB = this.$abtest('experiment-b', true, true, 1);
    console.log('expB is always 1');

    // Scenario: Prevent reporting analytics in a specific part of the code.
    // (meaning.. assigning a variant but preventing it from being reported).
    const expC = this.$abtest('experiment-c', true, false)
    console.log('expC is ' + expC + ' but was not reported');

    // Scenario: We have steps and we want to avoid activating the a/b test in any step.
    // (meaning.. avoid assigning a variant and reporting it).
    const expD = this.$abtest('experiment-d', false)
    console.log('expD is always 0');
  }
}
```

An example of event properties reported to Segment:

```js
{
  experiment: 'experiment-x',
  variant: 1
}
```

## Credits

- [Brandon Mills](https://github.com/btmills) for `weightedRandom()`

## License

See the LICENSE file for license rights and limitations (MIT).
