# Baker
Off-Screen Rendering, to generate Spherical harmonics and IBL mipmaps


# npm

The `Baker` is published on npm with full typing support. To install, use:

```sh
$ npm install @galacean/tools-baker
```

This will allow you to import package entirely using:

```javascript
import * as BAKER from "@galacean/tools-baker";
```

or individual classes using:

```javascript
import { IBLBaker } from "@galacean/tools-baker";
```

## Usage

```ts
const texture = await engine.resourceManager.load<TextureCube>({
    url: "https://gw.alipayobjects.com/os/bmw-prod/10c5d68d-8580-4bd9-8795-6f1035782b94.bin", // sunset_1K
    type: "HDR-RGBE"
  })

const bakedTexture = IBLBaker.fromTextureCubeMap(texture, DecodeMode.RGBE);
ambientLight.specularTexture = bakedHDRCubeMap;
ambientLight.specularTextureDecodeRGBM = true;

const sh = new SphericalHarmonics3();
SphericalHarmonics3Baker.fromTextureCubeMap(hdrCubeMap, DecodeMode.RGBE, sh);
ambientLight.diffuseMode = DiffuseMode.SphericalHarmonics;
ambientLight.diffuseSphericalHarmonics = sh;
```



## Links

- [Repository](https://github.com/ant-galaxy/@galacean/tools)
- [Examples](https://oasisengine.cn/#/examples/latest/ibl-baker)
- [Documentation](https://oasisengine.cn/#/docs/latest/cn/install)
- [API References](https://oasisengine.cn/#/api/latest/core)

## License

The engine is released under the [MIT](https://opensource.org/licenses/MIT) license. See LICENSE file.
