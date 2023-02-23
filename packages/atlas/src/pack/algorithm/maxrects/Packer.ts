import Jimp from "jimp";

import { Rect } from "../Rect";
import { MaxRectsMethod } from "../enums/MaxRectsMethod";
import { AtlasFormat } from "../enums/AtlasFormat";
import { MaxRectsBinPack } from "./MaxRectsBinPack";
import { Exporter } from "./Exporter";

const POTS = [
  2048,
  1024,
  512,
  256,
  128,
  64,
  32,
  16,
  8,
  4,
  2
];

export interface MaxRectsOption {
  width: number;
  height: number;
  padding: number;
  allowRotate: boolean;
  square: boolean;
  pot: boolean;
  format: AtlasFormat;
  output: string;
  editorExtras: Array<any>;
}

export class MaxRectsPacker {
  packedRects: Array<Rect> = [];
  packedWidth: number = 0;
  packedHeight: number = 0;
  padding: number;
  images: any = {};

  private _pack;
  private _exporter: Exporter;
  private _rects: Array<Rect> = [];
  private _rectsCount: number = 0;
  private _width: number;
  private _height: number;
  private _allowRotate: boolean;
  private _square: boolean;
  private _pot: boolean;

  constructor(option: MaxRectsOption) {
    this.padding = option.padding;
    this._allowRotate = option.allowRotate;

    const square = (this._square = option.square);
    if (square) {
      this._width = this._height = Math.min(option.width, option.height);
    } else {
      this._width = option.width;
      this._height = option.height;
    }

    const pot = (this._pot = option.pot);
    if (pot) {
      let widthFlag = false;
      let heightFlag = false;
      for (let i = 0, l = POTS.length; i < l; ++i) {
        const curPot = POTS[i];
        if (!widthFlag && this._width >= curPot) {
          this._width = curPot;
          widthFlag = true;
        }
        if (!heightFlag && this._height >= curPot) {
          this._height = curPot;
          heightFlag = true;
        }

        if (widthFlag && heightFlag) {
          break;
        }
      }
    }

    this._pack = new MaxRectsBinPack(
      this._width,
      this._height,
      this._allowRotate
    );
    this._exporter = new Exporter(option.format);
  }

  async addImages(imageFiles: Array<string>, names: Array<string>) {
    const { images } = this;
    for (let i = 0, l = imageFiles.length; i < l; ++i) {
      const file = imageFiles[i];
      const name = names[i];
      const image = await Jimp.read(file);
      images[name] = image;
      const { bitmap } = image;
      this._addRect(bitmap.width, bitmap.height, name);
    }
  }

  pack(method: MaxRectsMethod): void {
    this.packedRects = <Array<Rect>>this._pack.insert2(this._rects, method);
    const rects = this.packedRects;
    const len = rects.length;
    if (len > 0) {
      let maxWidth = 0;
      let maxHeight = 0;
      let padding = this.padding;
      let doublePadding = padding * 2;
      for (let i = 0; i < len; ++i) {
        const rect = rects[i];
        const width = rect.x + rect.width;
        const height = rect.y + rect.height;
        maxWidth = Math.max(maxWidth, width);
        maxHeight = Math.max(maxHeight, height);

        if (padding > 0) {
          rect.x += padding;
          rect.y += padding;
          rect.width -= doublePadding;
          rect.height -= doublePadding;
        }
      }

      if (this._square) {
        maxWidth = maxHeight = Math.max(maxWidth, maxHeight);
      }

      if (this._pot) {
        let widthFlag = false;
        let heightFlag = false;
        for (let i = POTS.length - 1; i >= 0; --i) {
          const curPot = POTS[i];
          if (!widthFlag && maxWidth <= curPot) {
            maxWidth = curPot;
            widthFlag = true;
          }
          if (!heightFlag && maxHeight <= curPot) {
            maxHeight = curPot;
            heightFlag = true;
          }

          if (widthFlag && heightFlag) {
            break;
          }
        }
      }

      this.packedWidth = maxWidth;
      this.packedHeight = maxHeight;
    }
  }

  async export(version: string, output: string) {
    const ret: any = {};

    if (this._rectsCount !== this.packedRects.length) {
      ret.code = 1;
      ret.msg = 'Atlas exceeds maximum size';
      return ret;
    }

    const fileInfo = await this._exporter.export(
      version,
      output,
      this
    );

    ret.code = 0;
    ret.msg = 'Atlas success';
    ret.info = fileInfo;

    return ret;
  }

  private _addRect(width: number, height: number, name: string): void {
    const padding = this.padding * 2;
    if (padding > 0) {
      width += padding;
      height += padding;
    }
    this._rects.push(new Rect(0, 0, width, height, name));
    this._rectsCount++;
  }
}
