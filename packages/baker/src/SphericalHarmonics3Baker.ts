import { Color, SphericalHarmonics3, TextureCubeFace, TextureCube, Vector3 } from "@galacean/engine";
import { DecodeMode } from "./enums/DecodeMode";

/**
 * Bake irradiance into spherical harmonics3.
 * @remarks
 * http://www.ppsloan.org/publications/StupidSH36.pdf
 */
export class SphericalHarmonics3Baker {
  private static _tempColor: Color = new Color();
  private static _tempVector: Vector3 = new Vector3();

  /**
   * Bake from Cube texture.
   * @param texture - Cube texture
   * @param out - SH3 for output
   */
  static fromTextureCubeMap(texture: TextureCube, decodeMode: DecodeMode, out: SphericalHarmonics3): void {
    out.scale(0);

    const channelLength = 4;
    const textureSize = texture.width;
    const data = new Uint8Array(textureSize * textureSize * channelLength); // read pixel always return rgba
    const color = this._tempColor;
    const direction = this._tempVector;
    const texelSize = 2 / textureSize; // convolution is in the space of [-1, 1]

    let solidAngleSum = 0; // ideal value is 4 * pi

    for (let faceIndex = 0; faceIndex < 6; faceIndex++) {
      texture.getPixelBuffer(TextureCubeFace.PositiveX + faceIndex, 0, 0, textureSize, textureSize, 0, data);
      let v = texelSize * 0.5 - 1;
      for (let y = 0; y < textureSize; y++) {
        let u = texelSize * 0.5 - 1;
        for (let x = 0; x < textureSize; x++) {
          const dataOffset = y * textureSize * channelLength + x * channelLength;

          switch (decodeMode) {
            case DecodeMode.Linear:
              color.set(data[dataOffset], data[dataOffset + 1], data[dataOffset + 2], 0);
              break;
            case DecodeMode.Gamma:
              color.set(
                Color.gammaToLinearSpace(data[dataOffset] / 255),
                Color.gammaToLinearSpace(data[dataOffset + 1] / 255),
                Color.gammaToLinearSpace(data[dataOffset + 2] / 255),
                0
              );
              break;
            case DecodeMode.RGBE:
              this._RGBEToLinear(
                data[dataOffset],
                data[dataOffset + 1],
                data[dataOffset + 2],
                data[dataOffset + 3],
                color
              );
              break;
            case DecodeMode.RGBM:
              this._RGBMToLinear(
                data[dataOffset],
                data[dataOffset + 1],
                data[dataOffset + 2],
                data[dataOffset + 3],
                color
              );
              break;
          }

          switch (faceIndex) {
            case TextureCubeFace.PositiveX:
              direction.set(1, -v, -u);
              break;
            case TextureCubeFace.NegativeX:
              direction.set(-1, -v, u);
              break;
            case TextureCubeFace.PositiveY:
              direction.set(u, 1, v);
              break;
            case TextureCubeFace.NegativeY:
              direction.set(u, -1, -v);
              break;
            case TextureCubeFace.PositiveZ:
              direction.set(u, -v, 1);
              break;
            case TextureCubeFace.NegativeZ:
              direction.set(-u, -v, -1);
              break;
          }

          /**
           * dA = cos = S / r = 4 / r
           * dw = dA / r2 = 4 / r / r2
           */
          const solidAngle = 4 / (direction.length() * direction.lengthSquared());
          solidAngleSum += solidAngle;
          out.addLight(direction.normalize(), color, solidAngle);
          u += texelSize;
        }
        v += texelSize;
      }
    }

    out.scale((4 * Math.PI) / solidAngleSum);
  }

  private static _RGBEToLinear(r: number, g: number, b: number, a: number, out: Color) {
    if (a === 0) {
      out.set(0, 0, 0, 1);
    } else {
      const scale = Math.pow(2, a - 128) / 255;
      out.set(r * scale, g * scale, b * scale, 1);
    }
  }

  private static _RGBMToLinear(r: number, g: number, b: number, a: number, out: Color) {
    const scale = a / 13005; // (a * 5) / 255 / 255;
    out.set(r * scale, g * scale, b * scale, 1);
  }
}
