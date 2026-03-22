import { ErrorCode } from "../enum/ErrorCode";
import { PackingContext } from "../interface/PackingContext";
import { AtlasConfig, AtlasSprite } from "../interface/PackingOutput";
import { PackingItem } from "../interface/PackingItem";
import { OptHandler } from "./OptHandler";

export class OptDrawing extends OptHandler {
  private canvas: OffscreenCanvas | HTMLCanvasElement;
  private context2D: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

  async parse(context: PackingContext): Promise<ErrorCode> {
    const info = (context.outPut.info = new AtlasConfig());
    const padding = context.option.padding ?? 0;
    const bins = context.bins ?? [];
    context.outPut.imageFiles = [];
    const atlasItems = info.atlasItems;
    for (let i = 0, n = bins.length; i < n; i++) {
      const bin = bins[i];
      this.initCanvas(bin.width, bin.height);
      const { context2D } = this;
      const { rects } = bin;
      const sprites = new Array<AtlasSprite>();
      const atlasItem = {
        img: "",
        type: "",
        width: bin.width,
        height: bin.height,
        sprites
      };
      for (let j = 0, m = rects.length; j < m; j++) {
        const atlasSprite = new AtlasSprite();
        const rect = rects[j];
        atlasSprite.name = rect.name;
        atlasSprite.atlasRotated = rect.isRotated;
        atlasSprite.atlasRegion = {
          x: rect.x,
          y: rect.y,
          w: rect.width,
          h: rect.height
        };
        const packingItem = this.getItem(context.images, rect.name);
        const image = packingItem?.image;
        if (image) {
          const sX = rect.x;
          const sY = rect.y;
          const trim = packingItem.trimRect;

          // Source region: use trim rect if available, otherwise full image.
          const srcX = trim ? trim.x : 0;
          const srcY = trim ? trim.y : 0;
          const srcW = trim ? trim.w : image.width;
          const srcH = trim ? trim.h : image.height;

          // Write atlasRegionOffset in pixels (left, top, right, bottom).
          // The engine loader handles normalization.
          if (trim) {
            const sw = packingItem.sourceWidth ?? image.width;
            const sh = packingItem.sourceHeight ?? image.height;
            atlasSprite.atlasRegionOffset = {
              x: trim.x,
              y: trim.y,
              z: sw - trim.x - trim.w,
              w: sh - trim.y - trim.h
            };
          }

          // If rotated, create a 90° clockwise rotated source; otherwise draw directly.
          let src: CanvasImageSource;
          let drawW: number;
          let drawH: number;
          if (rect.isRotated) {
            drawW = srcH;
            drawH = srcW;
            let tempCanvas: OffscreenCanvas | HTMLCanvasElement;
            try {
              tempCanvas = new OffscreenCanvas(drawW, drawH);
            } catch (e) {
              tempCanvas = document.createElement("canvas");
              tempCanvas.width = drawW;
              tempCanvas.height = drawH;
            }
            const tempCtx = tempCanvas.getContext("2d") as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
            tempCtx.translate(drawW, 0);
            tempCtx.rotate(Math.PI / 2);
            tempCtx.drawImage(image, srcX, srcY, srcW, srcH, 0, 0, srcW, srcH);
            src = tempCanvas;
          } else {
            drawW = srcW;
            drawH = srcH;
            src = image;
          }

          if (rect.isRotated) {
            context2D.drawImage(src, 0, 0, drawW, drawH, sX, sY, drawW, drawH);
          } else {
            context2D.drawImage(src, srcX, srcY, drawW, drawH, sX, sY, drawW, drawH);
          }

          // Handle padding pixels.
          if (padding > 0) {
            try {
              const padSrcX = rect.isRotated ? 0 : srcX;
              const padSrcY = rect.isRotated ? 0 : srcY;
              for (let i = 1; i <= padding; ++i) {
                // Top and bottom.
                context2D.drawImage(src, padSrcX, padSrcY, drawW, 1, sX, sY - i, drawW, 1);
                context2D.drawImage(src, padSrcX, padSrcY + drawH - 1, drawW, 1, sX, sY + drawH + i - 1, drawW, 1);
                // Left and right.
                context2D.drawImage(src, padSrcX, padSrcY, 1, drawH, sX - i, sY, 1, drawH);
                context2D.drawImage(src, padSrcX + drawW - 1, padSrcY, 1, drawH, sX + drawW + i - 1, sY, 1, drawH);
              }
            } catch (error) {
              console.error(JSON.stringify(error));
            }
          }
        }
        sprites.push(atlasSprite);
      }
      const arrayBuffer = await this.drawCanvas();
      if (!arrayBuffer) {
        return ErrorCode.CanvasBlobError;
      } else {
        context.outPut.imageFiles.push(arrayBuffer);
        atlasItems.push(atlasItem);
      }
    }
    return ErrorCode.Success;
  }

  private getItem(images: PackingItem[], name: string): PackingItem | null {
    for (let i = images.length - 1; i >= 0; i--) {
      if (images[i].name === name) {
        return images[i];
      }
    }
    return null;
  }

  initCanvas(exportWidth: number, exportHeight: number) {
    if (!this.canvas) {
      try {
        this.canvas = new OffscreenCanvas(exportWidth, exportHeight);
      } catch (error) {
        this.canvas = document.createElement("canvas");
        this.canvas.width = exportWidth;
        this.canvas.height = exportHeight;
      }
      this.context2D = this.canvas.getContext("2d", { willReadFrequently: true }) as
        | CanvasRenderingContext2D
        | OffscreenCanvasRenderingContext2D;
    } else {
      if (this.canvas.width !== exportWidth || this.canvas.height !== exportHeight) {
        this.canvas.width = exportWidth;
        this.canvas.height = exportHeight;
      } else {
        this.context2D.clearRect(0, 0, exportWidth, exportHeight);
      }
    }
  }

  async drawCanvas() {
    return new Promise<ArrayBuffer>((resolve, reject) => {
      if (this.canvas instanceof HTMLCanvasElement) {
        this.canvas.toBlob(
          (blob) => {
            blob
              .arrayBuffer()
              .then((value: ArrayBuffer) => {
                resolve(value);
              })
              .catch((reason: any) => {
                console.error(JSON.stringify(reason));
                reject(new Error("Failed to convert canvas blob to ArrayBuffer"));
              });
          },
          "image/png",
          1
        );
      } else {
        this.canvas
          .convertToBlob({ type: "image/png", quality: 1 })
          .then((blob) => {
            blob
              .arrayBuffer()
              .then((value: ArrayBuffer) => {
                resolve(value);
              })
              .catch((reason: any) => {
                console.error(JSON.stringify(reason));
                reject(new Error("Failed to convert offscreen blob to ArrayBuffer"));
              });
          })
          .catch((reason: any) => {
            console.error(JSON.stringify(reason));
            reject(new Error("Failed to convert offscreen canvas to blob"));
          });
      }
    });
  }
}
