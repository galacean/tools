import Jimp from "jimp";
const fs = require("fs");
const path = require("path");

import { AtlasFormat } from "../enums/AtlasFormat";
import { MaxRectsPacker } from "./Packer";

export class Exporter {
  private _format: AtlasFormat;

  get format(): AtlasFormat {
    return this._format;
  }

  set format(val: AtlasFormat) {
    this._format = val;
  }

  constructor(format: AtlasFormat) {
    this._format = format;
  }

  async export(version: string, output: string, packer: MaxRectsPacker) {
    switch (this.format) {
      case AtlasFormat.Galacean:
        return this._exportToGalacean(version, output, packer);
      default:
        return this._exportToGalacean(version, output, packer);
    }
  }

  private async _exportToGalacean(version: string, output: string, packer: MaxRectsPacker) {
    const res = { atlasItems: <any>[], version: version, format: 1};
    const imageFile = await this._generatePackedImage(output, packer);
    const item = {
      "img": `${path.basename(output)}.png`,
      "sprites": <any>[]
    };
    res.atlasItems.push(item);
    const { packedRects } = packer;
    const { sprites } = item;
    for (let i = 0, l = packedRects.length; i < l; ++i) {
      const rect = packedRects[i];
      sprites.push({
        "name": rect.name,
        "atlasRotated": rect.isRotated,
        "atlasRegion": {
          "x": rect.x,
          "y": rect.y,
          "w": rect.width,
          "h": rect.height
        },
        "originalSize": {
          "w": rect.width,
          "h": rect.height
        }
      });
    }

    try {
      const atlasStr = JSON.stringify(res);
      const atlasFile = path.resolve(`${output}.atlas`);
      await fs.writeFileSync(atlasFile, atlasStr);
      return {
        'imageFile': imageFile,
        'atlasFile': atlasFile
      };
    } catch (error) {
      throw new Error(`jsonParseErr【${output}】`);
    }
  }

  private async _generatePackedImage(output: string, packer: MaxRectsPacker) {
    const { packedWidth, packedHeight, packedRects, images, padding } = packer;
    const packedImage = new Jimp(packedWidth, packedHeight);
    for (let i = 0, l = packedRects.length; i < l; ++i) {
      const rect = packedRects[i];
      const name = rect.name;
      const image = <Jimp>images[name];
      if (image) {
        const { width, height } = image.bitmap;
        const startX = rect.x;
        const startY = rect.y;
        for (let i = 0; i < width; ++i) {
          const x = startX + i;
          for (let j = 0; j < height; ++j) {
            const y = startY + j;
            packedImage.setPixelColor(image.getPixelColor(i, j), x, y);
          }
        }

        // Handle padding pixels.
        if (padding > 0) {
          for (let i = 1; i <= padding; ++i) {
            // Set top and bottom.
            const topY = startY - i;
            const bottomY = startY + height + i - 1;
            for (let j = 0; j < width; ++j) {
              const x = startX + j;
              packedImage.setPixelColor(image.getPixelColor(j, i - 1), x, topY);
              packedImage.setPixelColor(image.getPixelColor(j, height - i), x, bottomY);
            }
            // Set left and right.
            const leftX = startX - i;
            const rightX = startX + width + i - 1;
            for (let j = 0; j < height; ++j) {
              const y = startY + j;
              packedImage.setPixelColor(image.getPixelColor(i - 1, j), leftX, y);
              packedImage.setPixelColor(image.getPixelColor(width - i, j), rightX, y);
            }
          }
        }
      }
    }

    const imageFile = path.resolve(`${output}.png`);
    await packedImage.writeAsync(imageFile);

    return imageFile;
  }
}
