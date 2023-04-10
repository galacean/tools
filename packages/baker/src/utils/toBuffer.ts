import { SphericalHarmonics3, TextureCubeFace, TextureCube } from "@galacean/engine";

export function toBuffer(bakedTexture: TextureCube, sh: SphericalHarmonics3): ArrayBuffer {
  const size = bakedTexture.width;
  const mipmapCount = bakedTexture.mipmapCount;

  const float32Array = new Float32Array(27);
  const floatByteLenth = 27 * 4;
  sh.copyToArray(float32Array);

  const uint8Arrays = [];
  let uint8ByteLength = 0;

  for (let mipLevel = 0; mipLevel < mipmapCount; mipLevel++) {
    const mipSize = size >> mipLevel;

    for (let face = 0; face < 6; face++) {
      const dataSize = mipSize * mipSize * 4;
      const data = new Uint8Array(dataSize);
      bakedTexture.getPixelBuffer(TextureCubeFace.PositiveX + face, 0, 0, mipSize, mipSize, mipLevel, data);
      uint8Arrays.push(data);
      uint8ByteLength += dataSize;
    }
  }

  // sh + size + mipData
  const arrayBuffer = new ArrayBuffer(floatByteLenth + 2 + uint8ByteLength);
  const shDataView = new DataView(arrayBuffer, 0, floatByteLenth);
  const mipDataView = new DataView(arrayBuffer, floatByteLenth);

  for (let i = 0; i < 27; i++) {
    shDataView.setFloat32(i * 4, float32Array[i], true);
  }

  mipDataView.setUint16(0, size, true);

  let offset = 2;
  for (let i = 0; i < uint8Arrays.length; i++) {
    const uint8Array = uint8Arrays[i];
    for (let j = 0, length = uint8Array.length; j < length; j++) {
      mipDataView.setUint8(offset++, uint8Array[j]);
    }
  }

  return arrayBuffer;
}
