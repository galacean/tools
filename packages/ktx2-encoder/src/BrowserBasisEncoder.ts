import { read, write } from "ktx-parse";
import { CubeBufferData, CubeMipmapBufferData, IBasisModule, IEncodeOptions } from "./type";
import { applyInputOptions } from "./applyInputOptions";
import { BasisTextureType, HDRSourceType, SourceType } from "./enum";
import type { IKtx2Encoder } from "./IKtx2Encoder";

const DEFAULT_WASM_URL =
  "https://mdn.alipayobjects.com/rms/afts/file/A*r7D4SKbksYcAAAAAAAAAAAAAARQnAQ/basis_encoder.wasm";

let modulePromise: Promise<IBasisModule> | null = null;

async function initBrowserModule(options?: Partial<IEncodeOptions>): Promise<IBasisModule> {
  if (!modulePromise) {
    modulePromise = (async () => {
      const wasmUrl = options?.wasmUrl ?? DEFAULT_WASM_URL;
      const jsUrl = options?.jsUrl ?? "../basis/basis_encoder.js";

      const [{ default: BASIS }, wasmBinary] = await Promise.all([
        fetch(jsUrl)
          .then((res) => res.text())
          .then((code) => {
            const blob = new Blob([code], { type: "application/javascript" });
            return import(/* @vite-ignore */ URL.createObjectURL(blob));
          }),
        wasmUrl ? fetch(wasmUrl).then((res) => res.arrayBuffer()) : undefined,
      ]);

      const Module: IBasisModule = await BASIS({ wasmBinary });
      Module.initializeBasis();
      return Module;
    })();
  }
  return modulePromise;
}

async function decodeImageBrowser(buffer: Uint8Array): Promise<{ width: number; height: number; data: Uint8Array }> {
  const getGlContext = (() => {
    let gl: WebGL2RenderingContext | null = null;
    return () => {
      if (!gl) {
        const canvas = new OffscreenCanvas(128, 128);
        gl = canvas.getContext("webgl2", { premultipliedAlpha: false }) as WebGL2RenderingContext;
      }
      return gl;
    };
  })();

  const gl = getGlContext();
  const imageBitmap = await createImageBitmap(new Blob([buffer as BlobPart]));
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, imageBitmap);

  const framebuffer = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);

  const { width, height } = imageBitmap;
  const pixels = new Uint8Array(width * height * 4);
  gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

  gl.deleteTexture(texture);
  gl.deleteFramebuffer(framebuffer);

  return { data: pixels, width, height };
}

/**
 * Browser KTX2 encoder — self-contained, no global registration needed.
 */
class BasisEncoder implements IKtx2Encoder {
  /**
   * encode image data to ktx2 file data
   * @param bufferOrBufferArray - image data, can be:
   *  - Uint8Array: single 2D image
   *  - CubeBufferData (6-element array): cubemap with 6 faces (base level only, auto-generates mipmaps)
   *  - CubeMipmapBufferData (nested array): cubemap with pre-computed mipmaps per face.
   *    Outer array is mip levels, inner array is 6 faces. Auto mipmap generation is disabled.
   *    Face order per mip level:
   *      0: Positive X, 1: Negative X, 2: Positive Y, 3: Negative Y, 4: Positive Z, 5: Negative Z
   * @param options - encode options, see {@link IEncodeOptions}
   * @returns ktx2 file data
   */
  async encode(
    bufferOrBufferArray: Uint8Array | CubeBufferData | CubeMipmapBufferData,
    options: Partial<IEncodeOptions> = {}
  ): Promise<Uint8Array> {
    const basisModule = await initBrowserModule(options);
    options.imageDecoder ??= decodeImageBrowser;

    const encoder = new basisModule.BasisEncoder();
    const isCubeMipmap = Array.isArray(bufferOrBufferArray) && Array.isArray(bufferOrBufferArray[0]);
    const isCube = isCubeMipmap || (Array.isArray(bufferOrBufferArray) && bufferOrBufferArray.length === 6);

    if (isCubeMipmap) {
      // Basis encoder requires all slices to have the same resolution.
      // Encode each mip level as a separate cubemap, then merge into one KTX2 container.
      encoder.delete();
      return this._encodeCubeMipmap(basisModule, bufferOrBufferArray as CubeMipmapBufferData, options);
    }

    applyInputOptions(options, encoder);
    encoder.setTexType(
      isCube ? BasisTextureType.cBASISTexTypeCubemapArray : BasisTextureType.cBASISTexType2D
    );

    {
      // Single image or 6-face cubemap (base level only)
      const bufferArray: Uint8Array[] = Array.isArray(bufferOrBufferArray)
        ? (bufferOrBufferArray as Uint8Array[])
        : [bufferOrBufferArray as Uint8Array];
      for (let i = 0; i < bufferArray.length; i++) {
        const buffer = bufferArray[i];
        if (options.isHDR) {
          const imageType = (options as any).imageType as HDRSourceType;
          const isRaster = imageType === HDRSourceType.RGBAHalfFloat || imageType === HDRSourceType.RGBAFloat;
          encoder.setSliceSourceImageHDR(
            i, buffer,
            isRaster ? options.width! : 0,
            isRaster ? options.height! : 0,
            imageType, true
          );
        } else {
          const imageData = await options.imageDecoder!(buffer);
          encoder.setSliceSourceImage(
            i,
            new Uint8Array(imageData.data),
            imageData.width,
            imageData.height,
            SourceType.RAW
          );
        }
      }
    }

    const ktx2FileData = new Uint8Array(1024 * 1024 * (options.isHDR ? 24 : 10));
    const byteLength = encoder.encode(ktx2FileData);
    if (byteLength === 0) {
      throw new Error("Encode failed");
    }
    let actualKTX2FileData = new Uint8Array(ktx2FileData.buffer as ArrayBuffer, 0, byteLength);
    if (options.kvData) {
      const container = read(actualKTX2FileData);
      for (let k in options.kvData) {
        container.keyValue[k] = options.kvData[k];
      }
      actualKTX2FileData = write(container, { keepWriter: true }) as Uint8Array<ArrayBuffer>;
    }
    return actualKTX2FileData;
  }

  /**
   * Encode a cubemap with pre-computed mipmaps by encoding each mip level separately,
   * then merging the per-level KTX2 data into a single KTX2 container.
   */
  private async _encodeCubeMipmap(
    basisModule: IBasisModule,
    mipLevels: CubeMipmapBufferData,
    options: Partial<IEncodeOptions>
  ): Promise<Uint8Array> {
    const mipOptions: Partial<IEncodeOptions> = { ...options, generateMipmap: false };
    const baseWidth = options.width!;
    const baseHeight = options.height!;

    // Encode each mip level as an independent cubemap
    let baseContainer: ReturnType<typeof read> | null = null;
    for (let mip = 0; mip < mipLevels.length; mip++) {
      const faces = mipLevels[mip];
      const mipWidth = baseWidth >> mip;
      const mipHeight = baseHeight >> mip;

      const encoder = new basisModule.BasisEncoder();
      applyInputOptions(mipOptions, encoder);
      encoder.setTexType(BasisTextureType.cBASISTexTypeCubemapArray);

      for (let face = 0; face < faces.length; face++) {
        if (options.isHDR) {
          encoder.setSliceSourceImageHDR(
            face, faces[face], mipWidth, mipHeight,
            (options as any).imageType, true
          );
        } else {
          encoder.setSliceSourceImage(
            face, faces[face], mipWidth, mipHeight, SourceType.RAW
          );
        }
      }

      const ktx2FileData = new Uint8Array(1024 * 1024 * (options.isHDR ? 24 : 10));
      const byteLength = encoder.encode(ktx2FileData);
      encoder.delete();
      if (byteLength === 0) {
        throw new Error(`Encode failed at mip level ${mip}`);
      }

      const mipContainer = read(new Uint8Array(ktx2FileData.buffer as ArrayBuffer, 0, byteLength));
      if (mip === 0) {
        baseContainer = mipContainer;
      } else {
        // Append this mip level's data to the base container
        baseContainer!.levels.push(mipContainer.levels[0]);
      }
    }

    if (options.kvData) {
      for (const k in options.kvData) {
        baseContainer!.keyValue[k] = options.kvData[k];
      }
    }

    return write(baseContainer!, { keepWriter: true }) as Uint8Array<ArrayBuffer>;
  }

  setTextureParams(
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
}

export const basisEncoder = new BasisEncoder();
