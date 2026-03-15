import { MaxRectsMethod, Rect, SmartRectsBinPack } from "@galacean/tools-atlas-algorithm";
import { ErrorCode } from "../enum/ErrorCode";
import { PackingBin, PackingContext } from "../interface/PackingContext";
import { OptHandler } from "./OptHandler";

const POTS = [2048, 1024, 512, 256, 128, 64, 32, 16, 8, 4, 2];

export class OptPacking extends OptHandler {
  parse(context: PackingContext): ErrorCode {
    const { option, images } = context;
    const padding = option.padding ?? 0;
    const allowRotate = !!option.allowRotate;
    const method = option.method ?? MaxRectsMethod.BestLongSideFit;
    let optionWidth: number;
    let optionHeight: number;

    if (option.square) {
      optionWidth = optionHeight = Math.min(option.width, option.height);
    } else {
      optionWidth = option.width;
      optionHeight = option.height;
    }

    if (option.pot) {
      let widthFlag = false;
      let heightFlag = false;
      for (let i = 0, l = POTS.length; i < l; ++i) {
        const curPot = POTS[i];
        if (!widthFlag && optionWidth >= curPot) {
          optionWidth = curPot;
          widthFlag = true;
        }
        if (!heightFlag && optionHeight >= curPot) {
          optionHeight = curPot;
          heightFlag = true;
        }

        if (widthFlag && heightFlag) {
          break;
        }
      }
    }

    const rects: Rect[] = [];
    const doublePadding = padding * 2;
    for (let i = images.length - 1; i >= 0; i--) {
      const file = images[i];
      const image = file.image;
      if (!image) {
        return ErrorCode.ImageLoadError;
      }
      const packW = file.trimRect ? file.trimRect.w : image.width;
      const packH = file.trimRect ? file.trimRect.h : image.height;
      if (!this.checkSizeLegality(packW, packH, optionWidth, optionHeight, doublePadding, allowRotate)) {
        // 打包失败
        console.log("打包失败，", file.name, "单图尺寸超图集大小");
        return ErrorCode.PackError;
      }
      rects.push(new Rect(0, 0, packW + doublePadding, packH + doublePadding, file.name));
    }

    const bins: PackingBin[] = [];
    while (rects.length > 0) {
      const packer = new SmartRectsBinPack();
      packer.init(optionWidth, optionHeight, allowRotate);
      const packed = packer.insert2(rects, method);
      if (packed.length === 0) {
        return ErrorCode.PackError;
      }
      let exportWidth = 0;
      let exportHeight = 0;
      for (let i = 0; i < packed.length; i++) {
        const rect = packed[i];
        const placedWidth = rect.isRotated ? rect.height : rect.width;
        const placedHeight = rect.isRotated ? rect.width : rect.height;
        const width = rect.x + placedWidth;
        const height = rect.y + placedHeight;
        exportWidth = Math.max(exportWidth, width);
        exportHeight = Math.max(exportHeight, height);

        if (padding > 0) {
          rect.x += padding;
          rect.y += padding;
          rect.width -= doublePadding;
          rect.height -= doublePadding;
        }
      }

      if (option.square) {
        exportWidth = exportHeight = Math.max(exportWidth, exportHeight);
      }

      if (option.pot) {
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

      bins.push({ rects: packed, width: exportWidth, height: exportHeight });
    }

    context.bins = bins;
    return ErrorCode.Success;
  }

  /**
   * 检查单图尺寸是否合法
   * 如果单图的尺寸比整个图集的尺寸还大，需要直接返回错误
   * @param imgWidth - 单图宽度
   * @param imgHeight - 单图高度
   * @param atlasWidth - 图集宽度
   * @param atlasHeight - 图集高度
   * @param doublePadding - 2倍的padding
   * @param allowRotate - 是否支持旋转
   * @returns - 是否合法
   */
  private checkSizeLegality(
    imgWidth: number,
    imgHeight: number,
    atlasWidth: number,
    atlasHeight: number,
    doublePadding: number,
    allowRotate: boolean
  ) {
    const paddedWidth = imgWidth + doublePadding;
    const paddedHeight = imgHeight + doublePadding;
    if (allowRotate) {
      return (
        (paddedWidth <= atlasWidth && paddedHeight <= atlasHeight) ||
        (paddedHeight <= atlasWidth && paddedWidth <= atlasHeight)
      );
    }
    return paddedWidth <= atlasWidth && paddedHeight <= atlasHeight;
  }
}
