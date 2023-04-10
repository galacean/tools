const path = require("path");

import { findAllImageFilesSync } from "../utils";
import {
  AlgorithmType,
  AtlasFormat,
  MaxRectsMethod,
  MaxRectsOption,
  MaxRectsPacker,
} from "./algorithm";

const version = `__buildVersion`;
console.log(`atlas tool version: ${version}`);

export async function pack(imageFiles: Array<string>, cliOptions: any) {
  const realImageFiles: Array<string> = [];
  await findAllImageFilesSync(imageFiles, realImageFiles);

  switch (getAlgorithmType(cliOptions.algorithm)) {
    case AlgorithmType.MaxRects:
      return await packWithMaxRects(version, realImageFiles, {
        width: cliOptions.maxWidth || 1024,
        height: cliOptions.maxHeight || 1024,
        padding: typeof cliOptions.padding === 'undefined' ? 1 : cliOptions.padding,
        allowRotate: cliOptions.allowRotate || false,
        square: cliOptions.square || false,
        pot: cliOptions.pot || false,
        format: getAtlasFormat(cliOptions.format || 'galacean'),
        output: cliOptions.output || 'galacean',
        editorExtras: cliOptions.editorExtras || []
      });
    case AlgorithmType.Polygon:
      break;
    default:
      break;
  }
}

function getAlgorithmType(algorithm: string): AlgorithmType {
  switch (algorithm) {
    case "maxrects":
      return AlgorithmType.MaxRects;
    default:
      return AlgorithmType.MaxRects;
  }
}

function getAtlasFormat(format: string): AtlasFormat {
  switch (format) {
    case "galacean":
      return AtlasFormat.Galacean;
    default:
      return AtlasFormat.Galacean;
  }
}

const nameSet = new Set();
async function packWithMaxRects(
  version: string,
  imageFiles: Array<string>,
  option: MaxRectsOption
) {
  const pack = new MaxRectsPacker(option);
  try {
    const names: Array<string> = [];
    nameSet.clear();

    const extras = option.editorExtras;
    let hasExtras = false;
    if (extras && extras.length > 0) {
      if (extras.length !== imageFiles.length) {
        return {
          code: 4,
          msg: 'Inconsistent with the number of images'
        }
      }
      hasExtras = true;
    }

    for (let i = 0, l = imageFiles.length; i < l; ++i) {
      const file = imageFiles[i];
      const name = hasExtras ? extras[i].name || '' : path.basename(file, path.extname(file));
      if (nameSet.has(name)) {
        return {
          code: 5,
          msg: `There is a image with the same name: ${name}`
        }
      }
      nameSet.add(name);
      names[i] = name;
    }
    await pack.addImages(imageFiles, names);
  } catch(error) {
    return {
      code: 3,
      msg: 'Read image error'
    }
  }
  pack.pack(MaxRectsMethod.BestLongSideFit);
  return await pack.export(version, option.output);
}

