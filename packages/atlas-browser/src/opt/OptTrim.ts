import { ErrorCode } from "../enum/ErrorCode";
import { PackingContext } from "../interface/PackingContext";
import { OptHandler } from "./OptHandler";

interface TrimContext {
  canvas: OffscreenCanvas | HTMLCanvasElement;
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
}

export class OptTrim extends OptHandler {
  private static _trimContext: TrimContext | null = null;

  private static _getTrimContext(): TrimContext {
    let { _trimContext: trimContext } = OptTrim;
    if (!trimContext) {
      let canvas: OffscreenCanvas | HTMLCanvasElement;
      try {
        canvas = new OffscreenCanvas(1, 1);
      } catch {
        canvas = document.createElement("canvas");
      }
      const ctx = canvas.getContext("2d", { willReadFrequently: true }) as
        | CanvasRenderingContext2D
        | OffscreenCanvasRenderingContext2D;
      trimContext = { canvas, ctx };
      OptTrim._trimContext = trimContext;
    }
    return trimContext;
  }

  parse(context: PackingContext): ErrorCode {
    if (!context.option.allowTrim) {
      return ErrorCode.Success;
    }

    const { images } = context;
    const { canvas, ctx } = OptTrim._getTrimContext();

    for (let i = 0, n = images.length; i < n; i++) {
      const item = images[i];
      const image = item.image;
      if (!image) {
        continue;
      }

      const { width, height } = image;
      item.sourceWidth = width;
      item.sourceHeight = height;

      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(image, 0, 0);
      const data = ctx.getImageData(0, 0, width, height).data;

      const trimRect = this._getTrimRect(data, width, height);
      if (trimRect.w < width || trimRect.h < height) {
        item.trimRect = trimRect;
      }
    }

    return ErrorCode.Success;
  }

  private _getTrimRect(
    data: Uint8ClampedArray,
    width: number,
    height: number
  ): { x: number; y: number; w: number; h: number } {
    let left = width;
    let right = 0;
    let top = height;
    let bottom = 0;

    for (let y = 0; y < height; y++) {
      const rowOffset = y * width * 4;
      for (let x = 0; x < width; x++) {
        const alpha = data[rowOffset + x * 4 + 3];
        if (alpha > 0) {
          if (x < left) left = x;
          if (x > right) right = x;
          if (y < top) top = y;
          if (y > bottom) bottom = y;
        }
      }
    }

    // Fully transparent image — keep at least 1×1.
    if (right < left || bottom < top) {
      return { x: 0, y: 0, w: 1, h: 1 };
    }

    return { x: left, y: top, w: right - left + 1, h: bottom - top + 1 };
  }
}
