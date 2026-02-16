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
        const image = this.getImage(context.images, rect.name);
        if (image) {
          const { width: imgW, height: imgH } = image;
          const sX = rect.x;
          const sY = rect.y;
          context2D.drawImage(image, 0, 0, imgW, imgH, sX, sY, imgW, imgH);

          // Handle padding pixels.
          if (padding > 0) {
            try {
              for (let i = 1; i <= padding; ++i) {
                // Set top and bottom.
                const topY = sY - i;
                const bottomY = sY + imgH + i - 1;
                context2D.drawImage(image, 0, 0, imgW, 1, sX, topY, imgW, 1);
                context2D.drawImage(image, 0, imgH - 1, imgW, 1, sX, bottomY, imgW, 1);

                // Set left and right.
                const leftX = sX - i;
                const rightX = sX + imgW + i - 1;
                context2D.drawImage(image, 0, 0, 1, imgH, leftX, sY, 1, imgH);
                context2D.drawImage(image, imgW - 1, 0, 1, imgH, rightX, sY, 1, imgH);
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

  private getImage(images: PackingItem[], name: string): HTMLImageElement | null {
    for (let i = images.length - 1; i >= 0; i--) {
      const image = images[i];
      if (image.name === name) {
        return image.image;
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
                reject(null);
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
                reject(null);
              });
          })
          .catch((reason: any) => {
            console.error(JSON.stringify(reason));
            reject(null);
          });
      }
    });
  }
}
