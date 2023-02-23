# Oasis Engine Tools

<a href="https://www.npmjs.com/package/oasis-engine-tools"><img src="https://img.shields.io/npm/v/oasis-engine-tools"/></a> ![npm-size](https://img.shields.io/bundlephobia/minzip/oasis-engine-tools) ![npm-download](https://img.shields.io/npm/dm/oasis-engine-tools) [![codecov](https://codecov.io/gh/oasis-engine/engine/branch/main/graph/badge.svg?token=KR2UBKE3OX)](https://codecov.io/gh/oasis-engine/engine-tools)

Some useful tools that can be used in [Oasis engine](https://github.com/oasis-engine/engine).

## npm

The tools is published on npm with full typing support. To install, use:

```sh
npm install oasis-engine-tools
```

This will allow you to import tools entirely using:

```javascript
import * as tools from "oasis-engine-tools";
```

or individual classes using:

```javascript
import { IBLBaker } from "oasis-engine-tools";
```

## Contributing

Everyone is welcome to join us! Whether you find a bug, have a great feature request or you fancy owning a task from the road map feel free to get in touch.

Make sure to read the [Contributing Guide](.github/HOW_TO_CONTRIBUTE.md) / [贡献指南](https://github.com/oasis-engine/engine/wiki/%E5%A6%82%E4%BD%95%E4%B8%8E%E6%88%91%E4%BB%AC%E5%85%B1%E5%BB%BA-Oasis-%E5%BC%80%E6%BA%90%E4%BA%92%E5%8A%A8%E5%BC%95%E6%93%8E) before submitting changes.

## Build

prerequisites:

- [Node.js v15.0.0+](https://nodejs.org/en/) and NPM (Install Node.js By official website)
- [PNPM](https://pnpm.io/) (Install Pnpm globally by `npm install -g pnpm`)

First, you need to install the dependencies:

```sh
pnpm install
```

Then, to build the source, using npm:

```sh
npm run b:all
```

## Links

- [Repository](https://github.com/ant-galaxy/oasis-engine-tools)
- [Examples](https://oasisengine.cn/#/examples/latest/ibl-baker)
- [Documentation](https://oasisengine.cn/#/docs/latest/cn/install)
- [API References](https://oasisengine.cn/#/api/latest/core)

## License

The engine is released under the [MIT](https://opensource.org/licenses/MIT) license. See LICENSE file.
