import { read, write } from "ktx-parse";
import { CubeBufferData, CubeMipmapBufferData, IBasisModule, IEncodeOptions } from "./type";
import { applyInputOptions } from "./applyInputOptions";
import { BasisTextureType, HDRSourceType, SourceType } from "./enum";

let promise: Promise<IBasisModule> | null = null;

const DEFAULT_WASM_URL =
  "https://mdn.alipayobjects.com/rms/afts/file/A*r7D4SKbksYcAAAAAAAAAAAAAARQnAQ/basis_encoder.wasm";

class BrowserBasisEncoder {
  async init(options?: { jsUrl?: string; wasmUrl?: string }) {
    if (!promise) {
      function _init(): Promise<IBasisModule> {
        const wasmUrl = options?.wasmUrl ?? DEFAULT_WASM_URL;
        const jsUrl = options?.jsUrl ?? "../basis/basis_encoder.js";
        return new Promise((resolve, reject) => {
          Promise.all([
            fetch(jsUrl)
              .then((res) => res.text())
              .then((code) => {
                const blob = new Blob([code], { type: "application/javascript" });
                return import(/* @vite-ignore */ URL.createObjectURL(blob));
              }),
            wasmUrl ? fetch(wasmUrl).then((res) => res.arrayBuffer()) : undefined
          ])
            .then(([{ default: BASIS }, wasmBinary]) => {
              return BASIS({ wasmBinary }).then((Module: IBasisModule) => {
                Module.initializeBasis();
                resolve(Module);
              });
            })
            .catch(reject);
        });
      }
      promise = _init();
    }
    return promise;
  }

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
    const basisModule = await this.init(options);
    const encoder = new basisModule.BasisEncoder();
    const isCubeMipmap = Array.isArray(bufferOrBufferArray) && Array.isArray(bufferOrBufferArray[0]);
    const isCube = isCubeMipmap || (Array.isArray(bufferOrBufferArray) && bufferOrBufferArray.length === 6);

    if (isCubeMipmap) {
      // Pre-computed mipmaps: disable auto mip generation
      options = { ...options, generateMipmap: false };
    }

    applyInputOptions(options, encoder);
    encoder.setTexType(
      isCube ? BasisTextureType.cBASISTexTypeCubemapArray : BasisTextureType.cBASISTexType2D
    );

    if (isCubeMipmap) {
      // Multi-mip cubemap: bufferOrBufferArray[mipLevel][faceIndex]
      const mipLevels = bufferOrBufferArray as CubeMipmapBufferData;
      let sliceIndex = 0;
      for (let mip = 0; mip < mipLevels.length; mip++) {
        const faces = mipLevels[mip];
        const mipWidth = options.width! >> mip;
        const mipHeight = options.height! >> mip;
        for (let face = 0; face < faces.length; face++) {
          if (options.isHDR) {
            encoder.setSliceSourceImageHDR(
              sliceIndex, faces[face], mipWidth, mipHeight,
              (options as any).imageType, true
            );
          } else {
            encoder.setSliceSourceImage(
              sliceIndex, faces[face], mipWidth, mipHeight, SourceType.RAW
            );
          }
          sliceIndex++;
        }
      }
    } else {
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
      const container = read(ktx2FileData);
      for (let k in options.kvData) {
        container.keyValue[k] = options.kvData[k];
      }
      actualKTX2FileData = write(container, { keepWriter: true }) as Uint8Array<ArrayBuffer>;
    }
    return actualKTX2FileData;
  }
}

export const browserEncoder = new BrowserBasisEncoder();
