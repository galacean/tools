import { CubeBufferData, IEncodeOptions } from "./type";
import { browserEncoder } from "./BrowserBasisEncoder";
import { decodeImageBitmap } from "./decodeImageData";

export * from "./enum";
export * from "./type";

export function encodeToKTX2(imageBuffer: Uint8Array | CubeBufferData, options: Partial<IEncodeOptions>): Promise<Uint8Array> {
  options.imageDecoder ??= decodeImageBitmap;
  globalThis.__KTX2_DEBUG__ = options.enableDebug ?? false;
  return browserEncoder.encode(imageBuffer, options);
}
