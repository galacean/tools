import { SphericalHarmonics3, TextureCubeFace, TextureCube } from "@galacean/engine";

const FILE_HEADER_MAGIC = 0x4e434c47; // "GLCN" in little-endian
const FILE_TYPE = "AmbientLight";
const FILE_TYPE_BYTES = new TextEncoder().encode(FILE_TYPE);
// Align to 4 bytes so data can be accessed via TypedArray views
const FILE_HEADER_LENGTH = ((4 + 4 + 1 + 2 + FILE_TYPE_BYTES.length + 2) + 3) & ~3;

/**
 * Write standard Galacean FileHeader into a DataView.
 * Returns the header byte length (= data start offset).
 */
function writeFileHeader(dataView: DataView, buffer: ArrayBuffer, totalLength: number): number {
  dataView.setUint32(0, FILE_HEADER_MAGIC, true);
  dataView.setUint32(4, totalLength, true);
  dataView.setUint8(8, 1); // version
  dataView.setUint16(9, FILE_TYPE_BYTES.length, true);
  new Uint8Array(buffer, 11, FILE_TYPE_BYTES.length).set(FILE_TYPE_BYTES);
  dataView.setUint16(11 + FILE_TYPE_BYTES.length, 0, true); // nameLen = 0
  return FILE_HEADER_LENGTH;
}

/**
 * Create ambient light buffer with KTX2 compressed specular texture.
 * [FileHeader][SH3:108][ktx2Data]
 */
export function toBufferKTX2(sh: SphericalHarmonics3, ktx2Data: Uint8Array): ArrayBuffer {
  const shByteLength = 27 * 4;
  const totalLength = FILE_HEADER_LENGTH + shByteLength + ktx2Data.byteLength;
  const arrayBuffer = new ArrayBuffer(totalLength);
  const dataView = new DataView(arrayBuffer);

  const dataOffset = writeFileHeader(dataView, arrayBuffer, totalLength);

  // SH3 coefficients
  const float32Array = new Float32Array(27);
  sh.copyToArray(float32Array);
  for (let i = 0; i < 27; i++) {
    dataView.setFloat32(dataOffset + i * 4, float32Array[i], true);
  }

  // KTX2 data
  new Uint8Array(arrayBuffer, dataOffset + shByteLength).set(ktx2Data);

  return arrayBuffer;
}

/**
 * Create ambient light buffer with raw R16G16B16A16 specular texture.
 * [FileHeader][SH3:108][size:2][mipData]
 */
export function toBuffer(bakedTexture: TextureCube, sh: SphericalHarmonics3): ArrayBuffer {
  const size = bakedTexture.width;
  const mipmapCount = bakedTexture.mipmapCount;
  const shByteLength = 27 * 4;

  const float32Array = new Float32Array(27);
  sh.copyToArray(float32Array);

  const uint16Arrays: Uint16Array[] = [];
  let uint16ByteLength = 0;

  for (let mipLevel = 0; mipLevel < mipmapCount; mipLevel++) {
    const mipSize = size >> mipLevel;
    for (let face = 0; face < 6; face++) {
      const dataSize = mipSize * mipSize * 4;
      const data = new Uint16Array(dataSize);
      bakedTexture.getPixelBuffer(TextureCubeFace.PositiveX + face, 0, 0, mipSize, mipSize, mipLevel, data);
      uint16Arrays.push(data);
      uint16ByteLength += dataSize * 2;
    }
  }

  const dataLength = shByteLength + 2 + uint16ByteLength;
  const totalLength = FILE_HEADER_LENGTH + dataLength;
  const arrayBuffer = new ArrayBuffer(totalLength);
  const dataView = new DataView(arrayBuffer);

  const dataOffset = writeFileHeader(dataView, arrayBuffer, totalLength);

  // SH3 coefficients
  for (let i = 0; i < 27; i++) {
    dataView.setFloat32(dataOffset + i * 4, float32Array[i], true);
  }

  // Cube size
  dataView.setUint16(dataOffset + shByteLength, size, true);

  // Mipmap data
  let offset = dataOffset + shByteLength + 2;
  for (let i = 0; i < uint16Arrays.length; i++) {
    const uint16Array = uint16Arrays[i];
    for (let j = 0, length = uint16Array.length; j < length; j++) {
      dataView.setUint16(offset, uint16Array[j], true);
      offset += 2;
    }
  }

  return arrayBuffer;
}
