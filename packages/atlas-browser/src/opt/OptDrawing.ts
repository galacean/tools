import { ErrorCode } from "../enum/ErrorCode";
import { PackingContext } from "../interface/PackingContext";
import { AtlasConfig, AtlasSprite } from "../interface/PackingOutput";
import { OptHandler } from "./OptHandler";

export class OptDrawing extends OptHandler {
  private canvas: OffscreenCanvas | HTMLCanvasElement;
  private context2D: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

  async parse(context: PackingContext): Promise<ErrorCode> {
    const info = (context.outPut.info = new AtlasConfig());
    const extrude = context.option.extrude;
    const { bins } = context.packer;
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
        const data = rect.data;
        atlasSprite.name = data.name;
        atlasSprite.atlasRotated = !!rect.rot;
        const offsetX = (rect.x || 0) + extrude;
        const offsetY = (rect.y || 0) + extrude;
        const width = rect.width - 2 * extrude;
        const height = rect.height - 2 * extrude;
        atlasSprite.atlasRegion = {
          x: offsetX,
          y: offsetY,
          w: width,
          h: height
        };
        const image = data.image;
        if (image) {
          // Handle extrude pixels.

          // Set top and bottom.
          const topY = offsetY - extrude;
          const bottomY = offsetY + height + extrude - 1;
          // Set left and right.
          const leftX = offsetX - extrude;
          const rightX = offsetX + width + extrude - 1;

          // border
          context2D.drawImage(image, 0, 0, width, 1, offsetX, topY, width, extrude);
          // context2D.drawImage(image, 0, height - 1, width, 1, offsetX, bottomY, width, extrude);
          context2D.drawImage(image, 0, 0, 1, height, leftX, offsetY, extrude, height);
          // context2D.drawImage(image, width - 1, 0, 1, height, rightX, offsetY, extrude, height);

          // corner
          // context2D.drawImage(image, 0, 0, 1, 1, offsetX, topY, width, extrude);
          // context2D.drawImage(image, 0, height - 1, width, 1, offsetX, bottomY, width, extrude);
          // context2D.drawImage(image, 0, 0, 1, height, leftX, offsetY, extrude, height);
          // context2D.drawImage(image, width - 1, 0, 1, height, rightX, offsetY, extrude, height);

          context2D.drawImage(image, 0, 0, width, height, offsetX, offsetY, width, height);
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

  initCanvas(exportWidth: number, exportHeight: number) {
    if (!this.canvas) {
      try {
        this.canvas = new OffscreenCanvas(exportWidth, exportHeight);
      } catch (error) {
        this.canvas = document.createElement("canvas");
        this.canvas.width = exportWidth;
        this.canvas.height = exportHeight;
      }
      this.context2D = this.canvas.getContext("2d") as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
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
