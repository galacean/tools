import { OptHandler } from "./OptHandler";
import { ErrorCode } from "../enum/ErrorCode";
import { Rect, MaxRectsBinPack } from "@galacean/tool-atlas-algorithm";
import { PackingContext } from "../interface/PackingContext";

const POTS = [2048, 1024, 512, 256, 128, 64, 32, 16, 8, 4, 2];

export class OptPacking extends OptHandler {
  private pack: MaxRectsBinPack = new MaxRectsBinPack();
  parse(context: PackingContext): ErrorCode {
    const { option, images } = context;
    const { padding, square, pot, method } = option;
    let width: number;
    let height: number;
    if (square) {
      width = height = Math.min(option.width, option.height);
    } else {
      width = option.width;
      height = option.height;
    }
    if (pot) {
      let widthFlag = false;
      let heightFlag = false;
      for (let i = 0, l = POTS.length; i < l; ++i) {
        const curPot = POTS[i];
        if (!widthFlag && width >= curPot) {
          width = curPot;
          widthFlag = true;
        }
        if (!heightFlag && height >= curPot) {
          height = curPot;
          heightFlag = true;
        }

        if (widthFlag && heightFlag) {
          break;
        }
      }
    }

    this.pack.init(width, height, option.allowRotate);

    const rects: Rect[] = [];
    const packCount = images.length;
    for (let i = packCount - 1; i >= 0; i--) {
      const file = images[i];
      const image = file.image;
      rects.push(new Rect(0, 0, image.width + padding * 2, image.height + padding * 2, file.name));
    }

    const resArray = (context.rects = <Array<Rect>>this.pack.insert2(rects, method));
    context.outPut.packedItem = resArray;
    const len = resArray.length;
    if (len === packCount) {
      let exportWidth = 0;
      let exportHeight = 0;
      let doublePadding = padding * 2;
      for (let i = 0; i < len; ++i) {
        const rect = resArray[i];
        const width = rect.x + rect.width;
        const height = rect.y + rect.height;
        exportWidth = Math.max(exportWidth, width);
        exportHeight = Math.max(exportHeight, height);

        if (padding > 0) {
          rect.x += padding;
          rect.y += padding;
          rect.width -= doublePadding;
          rect.height -= doublePadding;
        }
      }

      if (square) {
        exportWidth = exportHeight = Math.max(exportWidth, exportHeight);
      }

      if (pot) {
        let widthFlag = false;
        let heightFlag = false;
        for (let i = POTS.length - 1; i >= 0; --i) {
          const curPot = POTS[i];
          if (!widthFlag && exportWidth <= curPot) {
            exportWidth = curPot;
            widthFlag = true;
          }
          if (!heightFlag && exportHeight <= curPot) {
            exportHeight = curPot;
            heightFlag = true;
          }

          if (widthFlag && heightFlag) {
            break;
          }
        }
      }
      context.exportWidth = context.outPut.width = exportWidth;
      context.exportHeight = context.outPut.height = exportHeight;
      return ErrorCode.Success;
    } else {
      // 打包失败
      console.log("打包失败，尺寸有误", JSON.stringify(option));
      return ErrorCode.PackError;
    }
  }
}
