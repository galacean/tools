import assert from "assert";
import fs from "fs";
import path from "path";
import vm from "vm";
import {
  KHR_DF_MODEL_ETC1S,
  KHR_DF_TRANSFER_LINEAR,
  KHR_DF_TRANSFER_SRGB,
  KHR_SUPERCOMPRESSION_BASISLZ,
  read
} from "ktx-parse";
import { NodeKtx2Encoder } from "../../../packages/ktx2-encoder/src/NodeKtx2Encoder";

interface KTX2File {
  close(): void;
  delete(): void;
  getDFDTransferFunc(): number;
  getImageTranscodedSizeInBytes(level: number, layer: number, face: number, format: number): number;
  isValid(): boolean;
  startTranscoding(): boolean;
  transcodeImage(
    output: Uint8Array,
    level: number,
    layer: number,
    face: number,
    format: number,
    decodeFlags: number,
    outputRowPitch: number,
    outputHeight: number
  ): boolean;
}

interface BasisModule {
  KTX2File: new (data: Uint8Array) => KTX2File;
  initializeBasis(): void;
  transcoder_texture_format: { cTFRGBA32: { value: number } };
}

function createCheckerboard(first: [number, number, number], second: [number, number, number]): Uint8Array {
  const pixels = new Uint8Array(16 * 16 * 4);
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const color = (x + y) % 2 === 0 ? first : second;
      pixels.set([...color, 255], (y * 16 + x) * 4);
    }
  }
  return pixels;
}

async function loadBasisModule(): Promise<BasisModule> {
  const basisDirectory = path.resolve(__dirname, "../../../packages/ktx2-encoder/src/basis");
  const source = fs
    .readFileSync(path.join(basisDirectory, "basis_encoder.js"), "utf8")
    .replace(/\s*export default BASIS;?\s*$/, "");
  const sandbox = vm.createContext({
    process,
    Buffer,
    require,
    console,
    performance,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    setImmediate,
    clearImmediate,
    Promise,
    TextEncoder,
    TextDecoder,
    ArrayBuffer,
    SharedArrayBuffer,
    DataView,
    Uint8Array,
    Uint8ClampedArray,
    Uint16Array,
    Uint32Array,
    Int8Array,
    Int16Array,
    Int32Array,
    Float32Array,
    Float64Array,
    WebAssembly,
    URL,
    __dirname: basisDirectory,
    __filename: path.join(basisDirectory, "basis_encoder.js"),
    module: { exports: {} },
    exports: {}
  });
  vm.runInContext(source, sandbox);
  const factory = (sandbox as unknown as { BASIS: (options: { wasmBinary: Buffer }) => Promise<BasisModule> }).BASIS;
  const module = await factory({ wasmBinary: fs.readFileSync(path.join(basisDirectory, "basis_encoder.wasm")) });
  module.initializeBasis();
  return module;
}

function decodeMip(module: BasisModule, encoded: Uint8Array, level: number): { pixels: Uint8Array; transfer: number } {
  const file = new module.KTX2File(encoded);
  assert.ok(file.isValid());
  assert.ok(file.startTranscoding());
  const format = module.transcoder_texture_format.cTFRGBA32.value;
  const pixels = new Uint8Array(file.getImageTranscodedSizeInBytes(level, 0, 0, format));
  assert.ok(file.transcodeImage(pixels, level, 0, 0, format, 0, -1, -1));
  const transfer = file.getDFDTransferFunc();
  file.close();
  file.delete();
  return { pixels, transfer };
}

function redMean(pixels: Uint8Array): number {
  let sum = 0;
  for (let offset = 0; offset < pixels.length; offset += 4) sum += pixels[offset];
  return sum / (pixels.length / 4);
}

function normalLengthMean(pixels: Uint8Array): number {
  let sum = 0;
  for (let offset = 0; offset < pixels.length; offset += 4) {
    const x = pixels[offset] / 127.5 - 1;
    const y = pixels[offset + 1] / 127.5 - 1;
    const z = pixels[offset + 2] / 127.5 - 1;
    sum += Math.hypot(x, y, z);
  }
  return sum / (pixels.length / 4);
}

describe("Node KTX2 encoder", () => {
  let basisModule: BasisModule;

  before(async () => {
    basisModule = await loadBasisModule();
  });

  it("filters ETC1S sRGB mipmaps in linear light", async () => {
    const pixels = createCheckerboard([0, 0, 0], [255, 255, 255]);
    const encoder = new NodeKtx2Encoder({ imageDecoder: async () => ({ width: 16, height: 16, data: pixels }) });
    const encoded = await encoder.encode(pixels, {
      isUASTC: false,
      isSRGB: true,
      generateMipmap: true,
      qualityLevel: 255
    });
    const container = read(encoded);
    const mip = decodeMip(basisModule, encoded, 1);

    assert.strictEqual(container.supercompressionScheme, KHR_SUPERCOMPRESSION_BASISLZ);
    assert.strictEqual(container.dataFormatDescriptor[0].colorModel, KHR_DF_MODEL_ETC1S);
    assert.strictEqual(container.dataFormatDescriptor[0].transferFunction, KHR_DF_TRANSFER_SRGB);
    assert.strictEqual(container.levels.length, 5);
    assert.strictEqual(mip.transfer, KHR_DF_TRANSFER_SRGB);
    assert.ok(Math.abs(redMean(mip.pixels) - 188) <= 3);
  });

  it("keeps linear ETC1S mipmaps in linear space", async () => {
    const pixels = createCheckerboard([0, 0, 0], [255, 255, 255]);
    const encoder = new NodeKtx2Encoder({ imageDecoder: async () => ({ width: 16, height: 16, data: pixels }) });
    const encoded = await encoder.encode(pixels, {
      isUASTC: false,
      isSRGB: false,
      generateMipmap: true,
      qualityLevel: 255
    });
    const mip = decodeMip(basisModule, encoded, 1);

    assert.strictEqual(mip.transfer, KHR_DF_TRANSFER_LINEAR);
    assert.ok(Math.abs(redMean(mip.pixels) - 128) <= 3);
  });

  it("renormalizes generated normal-map mipmaps", async () => {
    const pixels = createCheckerboard([255, 128, 128], [128, 255, 128]);
    const encoder = new NodeKtx2Encoder({ imageDecoder: async () => ({ width: 16, height: 16, data: pixels }) });
    const encoded = await encoder.encode(pixels, {
      isUASTC: true,
      isNormalMap: true,
      generateMipmap: true
    });
    const mip = decodeMip(basisModule, encoded, 1);

    assert.strictEqual(mip.transfer, KHR_DF_TRANSFER_LINEAR);
    assert.ok(Math.abs(normalLengthMean(mip.pixels) - 1) <= 0.02);
  });
});
