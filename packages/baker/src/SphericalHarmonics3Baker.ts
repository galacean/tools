import { SphericalHarmonics3, TextureCube, TextureCubeFace } from "@galacean/engine";
import { WorkerManager } from "./WorkerManager";

/**
 * Bake irradiance into spherical harmonics3 and use WebWorker.
 * @remarks
 * http://www.ppsloan.org/publications/StupidSH36.pdf
 */
export class SphericalHarmonics3Baker {
  /**
   * Bake from Cube texture and use WebWorker.
   * @param texture - Cube texture
   * @param out - SH3 for output
   */
  static async fromTextureCube(texture: TextureCube, out: SphericalHarmonics3): Promise<SphericalHarmonics3> {
    const channelLength = 4;
    const textureSize = texture.width;

    // read pixel always return rgba
    const dataPX = new Uint16Array(textureSize * textureSize * channelLength);
    const dataNX = new Uint16Array(textureSize * textureSize * channelLength);
    const dataPY = new Uint16Array(textureSize * textureSize * channelLength);
    const dataNY = new Uint16Array(textureSize * textureSize * channelLength);
    const dataPZ = new Uint16Array(textureSize * textureSize * channelLength);
    const dataNZ = new Uint16Array(textureSize * textureSize * channelLength);
    texture.getPixelBuffer(TextureCubeFace.PositiveX, 0, 0, textureSize, textureSize, 0, dataPX);
    texture.getPixelBuffer(TextureCubeFace.NegativeX, 0, 0, textureSize, textureSize, 0, dataNX);
    texture.getPixelBuffer(TextureCubeFace.PositiveY, 0, 0, textureSize, textureSize, 0, dataPY);
    texture.getPixelBuffer(TextureCubeFace.NegativeY, 0, 0, textureSize, textureSize, 0, dataNY);
    texture.getPixelBuffer(TextureCubeFace.PositiveZ, 0, 0, textureSize, textureSize, 0, dataPZ);
    texture.getPixelBuffer(TextureCubeFace.NegativeZ, 0, 0, textureSize, textureSize, 0, dataNZ);
    const result = await WorkerManager.calculateSHFromTextureCube(
      dataPX,
      dataNX,
      dataPY,
      dataNY,
      dataPZ,
      dataNZ,
      textureSize
    );
    out.copyFromArray(result);
    return out;
  }
}

export function halfToFloat(halfBits: number): number {
  const sign = halfBits & 0x8000 ? -1 : 1;
  const exponent = (halfBits >> 10) & 0x1f;
  const mantissa = halfBits & 0x03ff;

  if (exponent === 0x1f) {
    return mantissa === 0 ? sign * Infinity : NaN;
  }

  if (exponent === 0) {
    return sign * 2 ** -14 * (mantissa / 1024);
  }

  return sign * 2 ** (exponent - 15) * (1 + mantissa / 1024);
}

export function addSH(direction: number[], color: number[], deltaSolidAngle: number, sh: Float32Array): void {
  const x = direction[0];
  const y = direction[1];
  const z = direction[2];
  const r = color[0] * deltaSolidAngle;
  const g = color[1] * deltaSolidAngle;
  const b = color[2] * deltaSolidAngle;
  const bv0 = 0.282095; // basis0 = 0.886227
  const bv1 = -0.488603 * y; // basis1 = -0.488603
  const bv2 = 0.488603 * z; // basis2 = 0.488603
  const bv3 = -0.488603 * x; // basis3 = -0.488603
  const bv4 = 1.092548 * (x * y); // basis4 = 1.092548
  const bv5 = -1.092548 * (y * z); // basis5 = -1.092548
  const bv6 = 0.315392 * (3 * z * z - 1); // basis6 = 0.315392
  const bv7 = -1.092548 * (x * z); // basis7 = -1.092548
  const bv8 = 0.546274 * (x * x - y * y); // basis8 = 0.546274

  (sh[0] += r * bv0), (sh[1] += g * bv0), (sh[2] += b * bv0);

  (sh[3] += r * bv1), (sh[4] += g * bv1), (sh[5] += b * bv1);
  (sh[6] += r * bv2), (sh[7] += g * bv2), (sh[8] += b * bv2);
  (sh[9] += r * bv3), (sh[10] += g * bv3), (sh[11] += b * bv3);

  (sh[12] += r * bv4), (sh[13] += g * bv4), (sh[14] += b * bv4);
  (sh[15] += r * bv5), (sh[16] += g * bv5), (sh[17] += b * bv5);
  (sh[18] += r * bv6), (sh[19] += g * bv6), (sh[20] += b * bv6);
  (sh[21] += r * bv7), (sh[22] += g * bv7), (sh[23] += b * bv7);
  (sh[24] += r * bv8), (sh[25] += g * bv8), (sh[26] += b * bv8);
}
export function scaleSH(array: Float32Array, scale: number): void {
  const src = array;
  (src[0] *= scale), (src[1] *= scale), (src[2] *= scale);
  (src[3] *= scale), (src[4] *= scale), (src[5] *= scale);
  (src[6] *= scale), (src[7] *= scale), (src[8] *= scale);
  (src[9] *= scale), (src[10] *= scale), (src[11] *= scale);
  (src[12] *= scale), (src[13] *= scale), (src[14] *= scale);
  (src[15] *= scale), (src[16] *= scale), (src[17] *= scale);
  (src[18] *= scale), (src[19] *= scale), (src[20] *= scale);
  (src[21] *= scale), (src[22] *= scale), (src[23] *= scale);
  (src[24] *= scale), (src[25] *= scale), (src[26] *= scale);
}

export function decodeFaceSH(
  faceData: Uint16Array,
  faceIndex: TextureCubeFace,
  textureSize: number,
  lastSolidAngleSum: number,
  sh: Float32Array // length 27
): number {
  const channelLength = 4;
  const texelSize = 2 / textureSize; // convolution is in the space of [-1, 1]
  const color = [];
  const direction = [];

  let v = texelSize * 0.5 - 1;
  let solidAngleSum = lastSolidAngleSum;

  for (let y = 0; y < textureSize; y++) {
    let u = texelSize * 0.5 - 1;
    for (let x = 0; x < textureSize; x++) {
      const dataOffset = y * textureSize * channelLength + x * channelLength;
      //  Linear (half-float)
      color[0] = halfToFloat(faceData[dataOffset]);
      color[1] = halfToFloat(faceData[dataOffset + 1]);
      color[2] = halfToFloat(faceData[dataOffset + 2]);
      color[3] = 1;

      switch (faceIndex) {
        case 0:
          direction[0] = 1;
          direction[1] = -v;
          direction[2] = -u;
          break;
        case 1:
          direction[0] = -1;
          direction[1] = -v;
          direction[2] = u;
          break;
        case 2:
          direction[0] = u;
          direction[1] = 1;
          direction[2] = v;
          break;
        case 3:
          direction[0] = u;
          direction[1] = -1;
          direction[2] = -v;
          break;
        case 4:
          direction[0] = u;
          direction[1] = -v;
          direction[2] = 1;
          break;
        case 5:
          direction[0] = -u;
          direction[1] = -v;
          direction[2] = -1;
          break;
      }

      /**
       * dA = cos = S / r = 4 / r
       * dw = dA / r2 = 4 / r / r2
       */
      const lengthSquared = direction[0] * direction[0] + direction[1] * direction[1] + direction[2] * direction[2];
      const directionLength = Math.sqrt(lengthSquared);
      const solidAngle = 4 / (directionLength * lengthSquared);
      // normalize
      direction[0] /= directionLength;
      direction[1] /= directionLength;
      direction[2] /= directionLength;
      solidAngleSum += solidAngle;
      addSH(direction, color, solidAngle, sh);
      u += texelSize;
    }
    v += texelSize;
  }

  return solidAngleSum;
}
