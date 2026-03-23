import type { CubeBufferData, CubeMipmapBufferData, IEncodeOptions } from "./type";

/**
 * Platform interface for KTX2 encoding — analogous to IPhysics in the engine.
 *
 * Implementations:
 *   - Browser: `encodeToKTX2()` (default, uses fetch + WebGL2 internally)
 *   - Node.js: `new NodeKtx2Encoder()` (uses vm + sharp, auto-loads bundled basis WASM)
 */
export interface IKtx2Encoder {
  /** Encode image data to KTX2 format. */
  encode(
    buffer: Uint8Array | CubeBufferData | CubeMipmapBufferData,
    options?: Partial<IEncodeOptions>
  ): Promise<Uint8Array>;
  /** Embed Galacean texture sampler parameters into a KTX2 container. */
  setTextureParams(
    buffer: Uint8Array,
    params: { wrapModeU: number; wrapModeV: number; filterMode: number; anisoLevel: number }
  ): Uint8Array;
}
