# Baker

Off-Screen Rendering, to generate Spherical harmonics and IBL mipmaps

# npm

The `Baker` is published on npm with full typing support. To install, use:

```sh
$ npm install @oasis-engine-tools/baker
```

This will allow you to import package entirely using:

```javascript
import * as BAKER from "@oasis-engine-tools/baker";
```

or individual classes using:

```javascript
import { IBLBaker } from "@oasis-engine-tools/baker";
```

## Usage

```ts
const bakedTexture = IBLBaker.fromScene(scene);
ambientLight.specularTexture = bakedTexture;

const sh = new SphericalHarmonics3();
SphericalHarmonics3Baker.fromTextureCubeMap(bakedTexture, sh);
ambientLight.diffuseMode = DiffuseMode.SphericalHarmonics;
ambientLight.diffuseSphericalHarmonics = sh;
```

## Links

- [Repository](https://github.com/ant-galaxy/oasis-engine-tools)
- [Examples](https://oasisengine.cn/#/examples/latest/ibl-baker)
- [Documentation](https://oasisengine.cn/#/docs/latest/cn/install)
- [API References](https://oasisengine.cn/#/api/latest/core)

## License

The engine is released under the [MIT](https://opensource.org/licenses/MIT) license. See LICENSE file.
