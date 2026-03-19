/**
 * Node.js KTX2 encoder — auto-loads bundled basis WASM, auto-detects sharp.
 *
 * Usage:
 * ```ts
 * import { NodeKtx2Encoder } from "@galacean/tools-ktx2-encoder"
 *
 * const ktx2 = new NodeKtx2Encoder()
 * const result = await ktx2.encode(buffer, { isUASTC: true })
 * const withParams = ktx2.setTextureParams(result, { wrapModeU: 1, wrapModeV: 1, filterMode: 1, anisoLevel: 1 })
 * ```
 */
import { read, write } from "ktx-parse"
import type { IKtx2Encoder } from "./IKtx2Encoder"
import type { CubeBufferData, CubeMipmapBufferData, IBasisModule, IEncodeOptions } from "./type"
import { applyInputOptions } from "./applyInputOptions"
import { BasisTextureType, HDRSourceType, SourceType } from "./enum"

export interface NodeKtx2EncoderOptions {
  /** Custom image decoder. Default: auto-detect sharp. */
  imageDecoder?: (buffer: Uint8Array) => Promise<{ width: number; height: number; data: Uint8Array }>
}

export class NodeKtx2Encoder implements IKtx2Encoder {
  private _modulePromise: Promise<IBasisModule> | null = null
  private _imageDecoder: (buffer: Uint8Array) => Promise<{ width: number; height: number; data: Uint8Array }>

  constructor(options?: NodeKtx2EncoderOptions) {
    this._imageDecoder = options?.imageDecoder ?? NodeKtx2Encoder._defaultImageDecoder
  }

  async encode(
    bufferOrBufferArray: Uint8Array | CubeBufferData | CubeMipmapBufferData,
    options: Partial<IEncodeOptions> = {}
  ): Promise<Uint8Array> {
    const basisModule = await this._ensureModule()
    const isCubeMipmap = Array.isArray(bufferOrBufferArray) && Array.isArray(bufferOrBufferArray[0])
    const isCube = isCubeMipmap || (Array.isArray(bufferOrBufferArray) && bufferOrBufferArray.length === 6)

    if (isCubeMipmap) {
      return this._encodeCubeMipmap(basisModule, bufferOrBufferArray as CubeMipmapBufferData, options)
    }

    const encoder = new basisModule.BasisEncoder()
    try {
      options.imageDecoder ??= this._imageDecoder
      applyInputOptions(options, encoder)
      encoder.setTexType(isCube ? BasisTextureType.cBASISTexTypeCubemapArray : BasisTextureType.cBASISTexType2D)

      const bufferArray: Uint8Array[] = Array.isArray(bufferOrBufferArray)
        ? (bufferOrBufferArray as Uint8Array[])
        : [bufferOrBufferArray as Uint8Array]
      for (let i = 0; i < bufferArray.length; i++) {
        const buffer = bufferArray[i]
        if (options.isHDR) {
          const imageType = (options as any).imageType as HDRSourceType
          const isRaster = imageType === HDRSourceType.RGBAHalfFloat || imageType === HDRSourceType.RGBAFloat
          encoder.setSliceSourceImageHDR(i, buffer, isRaster ? options.width! : 0, isRaster ? options.height! : 0, imageType, true)
        } else {
          const imageData = await options.imageDecoder!(buffer)
          encoder.setSliceSourceImage(i, new Uint8Array(imageData.data), imageData.width, imageData.height, SourceType.RAW)
        }
      }

      const ktx2FileData = new Uint8Array(1024 * 1024 * (options.isHDR ? 24 : 10))
      const byteLength = encoder.encode(ktx2FileData)
      if (byteLength === 0) throw new Error("Encode failed")

      let result = new Uint8Array(ktx2FileData.buffer as ArrayBuffer, 0, byteLength)
      if (options.kvData) {
        const container = read(result)
        for (const k in options.kvData) container.keyValue[k] = options.kvData[k]
        result = write(container, { keepWriter: true }) as Uint8Array<ArrayBuffer>
      }
      return result
    } finally {
      encoder.delete()
    }
  }

  setTextureParams(
    buffer: Uint8Array,
    params: { wrapModeU: number; wrapModeV: number; filterMode: number; anisoLevel: number }
  ): Uint8Array {
    const container = read(buffer)
    container.keyValue["GalaceanTextureParams"] = new Uint8Array([
      params.wrapModeU, params.wrapModeV, params.filterMode, params.anisoLevel,
    ])
    return write(container)
  }

  private async _ensureModule(): Promise<IBasisModule> {
    if (!this._modulePromise) {
      this._modulePromise = this._loadModule()
    }
    return this._modulePromise
  }

  private async _loadModule(): Promise<IBasisModule> {
    const vm = await import("node:vm")
    const nodeFs = await import("node:fs")
    const nodePath = await import("node:path")

    // Resolve basis files: use require.resolve for bundled builds (where __dirname
    // no longer points to the package source), fall back to __dirname for source/test
    const candidates: string[] = []
    try {
      const pkgDir = nodePath.dirname(require.resolve("@galacean/tools-ktx2-encoder"))
      candidates.push(nodePath.join(pkgDir, "basis"), nodePath.join(pkgDir, "..", "src", "basis"))
    } catch {}
    candidates.push(nodePath.join(__dirname, "..", "src", "basis"), nodePath.join(__dirname, "basis"), nodePath.join(__dirname, "assets"))
    const basisDir = candidates.find((d) => nodeFs.existsSync(nodePath.join(d, "basis_encoder.js")))
    if (!basisDir) {
      throw new Error(
        `Cannot find basis_encoder.js. Searched:\n${candidates.map((d) => `  - ${d}`).join("\n")}`
      )
    }
    // Strip `export default` which is needed for browser ESM import
    // but incompatible with vm.runInContext (classic script mode)
    const basisJs = nodeFs.readFileSync(nodePath.join(basisDir, "basis_encoder.js"), "utf-8")
      .replace(/^\s*export\s+default\s+.+$/m, "")
    const basisWasm = nodeFs.readFileSync(nodePath.join(basisDir, "basis_encoder.wasm"))

    const sandbox = vm.createContext({
      process, Buffer, require, console,
      setTimeout, clearTimeout, setInterval, clearInterval, setImmediate, clearImmediate,
      Promise, TextEncoder, TextDecoder,
      ArrayBuffer, SharedArrayBuffer, DataView,
      Uint8Array, Uint16Array, Uint32Array, Int8Array, Int16Array, Int32Array,
      Float32Array, Float64Array, Uint8ClampedArray, URL,
      __dirname: basisDir, __filename: nodePath.join(basisDir, "basis_encoder.js"),
      module: { exports: {} as any }, exports: {} as any,
    })

    vm.runInContext(basisJs, sandbox)
    const BASIS = (sandbox as any).BASIS ?? (sandbox as any).module?.exports
    if (typeof BASIS !== "function") throw new Error("basis_encoder.js did not export a BASIS factory function")

    const wasmBinary = basisWasm.buffer.slice(basisWasm.byteOffset, basisWasm.byteOffset + basisWasm.byteLength)
    const basisModule = await BASIS({ wasmBinary })
    basisModule.initializeBasis()
    return basisModule as IBasisModule
  }

  private async _encodeCubeMipmap(
    basisModule: IBasisModule,
    mipLevels: CubeMipmapBufferData,
    options: Partial<IEncodeOptions>
  ): Promise<Uint8Array> {
    const mipOptions: Partial<IEncodeOptions> = { ...options, generateMipmap: false }
    const baseWidth = options.width!
    const baseHeight = options.height!
    let baseContainer: ReturnType<typeof read> | null = null

    for (let mip = 0; mip < mipLevels.length; mip++) {
      const faces = mipLevels[mip]
      const mipWidth = baseWidth >> mip
      const mipHeight = baseHeight >> mip
      const encoder = new basisModule.BasisEncoder()
      applyInputOptions(mipOptions, encoder)
      encoder.setTexType(BasisTextureType.cBASISTexTypeCubemapArray)

      for (let face = 0; face < faces.length; face++) {
        if (options.isHDR) {
          encoder.setSliceSourceImageHDR(face, faces[face], mipWidth, mipHeight, (options as any).imageType, true)
        } else {
          encoder.setSliceSourceImage(face, faces[face], mipWidth, mipHeight, SourceType.RAW)
        }
      }

      const ktx2FileData = new Uint8Array(1024 * 1024 * (options.isHDR ? 24 : 10))
      const byteLength = encoder.encode(ktx2FileData)
      encoder.delete()
      if (byteLength === 0) throw new Error(`Encode failed at mip level ${mip}`)

      const mipContainer = read(new Uint8Array(ktx2FileData.buffer as ArrayBuffer, 0, byteLength))
      if (mip === 0) baseContainer = mipContainer
      else baseContainer!.levels.push(mipContainer.levels[0])
    }

    if (options.kvData) {
      for (const k in options.kvData) baseContainer!.keyValue[k] = options.kvData[k]
    }
    return write(baseContainer!, { keepWriter: true }) as Uint8Array<ArrayBuffer>
  }

  private static async _defaultImageDecoder(buffer: Uint8Array) {
    const sharp = (await import("sharp")).default
    const decoded = await sharp(Buffer.from(buffer)).raw().ensureAlpha().toBuffer({ resolveWithObject: true })
    return { width: decoded.info.width, height: decoded.info.height, data: new Uint8Array(decoded.data) }
  }
}
