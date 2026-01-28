import { MaxRectsPacker, PACKING_LOGIC } from "maxrects-packer";
import { ErrorCode } from "../enum/ErrorCode";
import { PackingContext } from "../interface/PackingContext";
import { OptHandler } from "./OptHandler";

export class OptPacking extends OptHandler {
  parse(context: PackingContext): ErrorCode {
    const { option, images } = context;
    const optionsArr = this.genOptions(option.pot, option.allowRotate);
    let bestPacker: MaxRectsPacker;
    let minArea = Number.MAX_SAFE_INTEGER;

    const { width: maxWidth, height: maxHeight, extrude } = option;
    for (let i = 0, n = optionsArr.length; i < n; i++) {
      const packCount = images.length;
      const input = [];
      for (let i = packCount - 1; i >= 0; i--) {
        const file = images[i];
        input.push({ width: file.width + 2 * extrude, height: file.height + 2 * extrude, data: file });
      }
      const packer = new MaxRectsPacker(maxWidth, maxHeight, option.padding, optionsArr[i]);
      packer.addArray(input);
      const bins = packer.bins;
      let sum = 0;
      // 检查每张图集，如果超过上限，需要返回失败
      for (let j = 0, m = bins.length; j < m; j++) {
        const { width, height } = bins[j];
        if (width > maxWidth || height > maxHeight) {
          return ErrorCode.PackError;
        } else {
          sum += width * height;
        }
      }
      if (sum < minArea) {
        minArea = sum;
        bestPacker = packer;
      }
    }
    context.packer = bestPacker;
    return ErrorCode.Success;
  }

  genOptions(pot: boolean, allowRotation: boolean) {
    return [
      { smart: true, pot, square: false, allowRotation, logic: PACKING_LOGIC.MAX_EDGE },
      { smart: true, pot, square: false, allowRotation, logic: PACKING_LOGIC.MAX_AREA },
      { smart: false, pot, square: true, allowRotation, logic: PACKING_LOGIC.MAX_EDGE },
      { smart: false, pot, square: true, allowRotation, logic: PACKING_LOGIC.MAX_AREA }
    ];
  }
}
