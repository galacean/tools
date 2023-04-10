import { TextureFormat } from "./TextureFormat";

// 多个 texturepacker 文件可以打包成一个 GalaceanAtlas 文件
export function texturePacker2Galacean(fileObjArr: any[]) {
  const res = { atlasItems: <any>[], version: "1.0", format: 0 };
  for (let i = 0; i < fileObjArr.length; i++) {
    const fileObj = fileObjArr[i];
    let frames = fileObj.frames;
    if (!frames || frames.length <= 0) {
      continue;
    }
    let frameKeys = Object.keys(frames);
    const atlasItem = { img: "$imgURL", sprites: <any>[] };
    for (let j = 0; j < frameKeys.length; j++) {
      const key = frameKeys[j];
      const frame = fileObj.frames[key];
      const sprite: any = {
        name: key,
      };
      const propNames = Object.keys(frame);
      for (let k = 0; k < propNames.length; k++) {
        const propName = propNames[k];
        switch (propName) {
          case "filename":
            sprite.name = frame.filename;
            break;
          case "frame":
            // 是否有旋转
            if (frame.rotated) {
              sprite.atlasRegion = {
                x: frame.frame.x,
                y: frame.frame.y,
                w: frame.frame.h,
                h: frame.frame.w,
              };
            } else {
              sprite.atlasRegion = frame.frame;
            }
            break;
          case "rotated":
            if (frame.rotated) {
              sprite.atlasRotated = true;
            }
            break;
          case "trimmed":
            sprite.atlasRegionOffset = {
              x: frame.spriteSourceSize.x,
              y: frame.spriteSourceSize.y,
              z: frame.sourceSize.w - frame.spriteSourceSize.x - frame.frame.w,
              w: frame.sourceSize.h - frame.spriteSourceSize.y - frame.frame.h,
            };
            break;
          case "pivot":
            sprite.pivot = frame.pivot;
            break;
          default:
            break;
        }
      }
      atlasItem.sprites.push(sprite);
    }
    res.atlasItems.push(atlasItem);
    let meta = fileObj.meta;
    switch (meta.format) {
      case "RGBA8888":
        res.format = TextureFormat.R8G8B8A8;
        break;
      case "RGBA4444":
        res.format = TextureFormat.R4G4B4A4;
        break;
      case "RGBA5551":
        res.format = TextureFormat.R5G5B5A1;
        break;
      case "RGB888":
        res.format = TextureFormat.R8G8B8;
        break;
      case "RGB565":
        res.format = TextureFormat.R5G6B5;
        break;
      case "RGBA5555":
      case "BGRA8888":
      case "ALPHA":
      case "ALPHA_INTENSITY":
      default:
        console.error(
          "不支持【" + meta.format + "】这种格式，请检查 mate.format 属性"
        );
        res.format = -1;
        break;
    }
  }
  return res.atlasItems.length > 0 ? res : null;
}
