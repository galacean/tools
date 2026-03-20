import { read, write } from "ktx-parse";
import { CubeBufferData, CubeMipmapBufferData, IEncodeOptions } from "./type";
import { basisEncoder } from "./BrowserBasisEncoder";

export * from "./enum";
export * from "./type";
export type { IKtx2Encoder } from "./IKtx2Encoder";
export { NodeKtx2Encoder, type NodeKtx2EncoderOptions } from "./NodeKtx2Encoder";

/**
 * Encode image data to KTX2 format (browser default entry point).
 * In Node.js, use `new NodeKtx2Encoder()` instead.
 */
export function encodeToKTX2(imageBuffer: Uint8Array | CubeBufferData | CubeMipmapBufferData, options: Partial<IEncodeOptions>): Promise<Uint8Array> {
  globalThis.__KTX2_DEBUG__ = options.enableDebug ?? false;
  return basisEncoder.encode(imageBuffer, options);
}

/**
 * Embed Galacean texture sampler parameters into a KTX2 container.
 * Standalone function — platform independent (uses ktx-parse).
 */
export function setTextureParams(
  buffer: Uint8Array,
  params: { wrapModeU: number; wrapModeV: number; filterMode: number; anisoLevel: number }
): Uint8Array {
  const container = read(buffer);
  container.keyValue["GalaceanTextureParams"] = new Uint8Array([
    params.wrapModeU,
    params.wrapModeV,
    params.filterMode,
    params.anisoLevel,
  ]);
  return write(container);
}
