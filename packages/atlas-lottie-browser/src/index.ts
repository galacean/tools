import { pack } from "@galacean/tools-atlas-browser";

function createEmptyAtlasFile() {
  return JSON.stringify({
    version: 0,
    format: 1,
    atlasItems: []
  });
}

export async function transform(lottie, images, options = {}) {
  try {
    const jsonData = JSON.parse(lottie);
    const assets = Array.isArray(jsonData.assets) ? jsonData.assets : [];
    const lottieImages = [];
    for (let i = 0, l = assets.length; i < l; i++) {
      const asset = assets[i];
      const { p } = asset;
      // sprite assets
      p &&
        lottieImages.push({
          name: asset.id,
          src: p
        });
    }
    // Some Lottie files are pure vector/text animations and do not contain image assets.
    // Keep the EditorLottie asset shape stable by returning an empty atlas instead of failing packing.
    if (lottieImages.length === 0) {
      jsonData.assets = assets.filter((asset) => {
        return !asset.p;
      });
      return {
        code: 0,
        msg: "打包成功！",
        info: {
          version: 0,
          format: 1,
          atlasItems: [],
          imageFiles: [],
          atlasFile: createEmptyAtlasFile(),
          jsonFile: JSON.stringify(jsonData)
        } as any
      };
    }
    const res = await pack(lottieImages, {
      width: 2048,
      height: 2048,
      ...options
    });
    if (res.code !== 0) {
      console.log("Atlas Error:", res.msg);
      return res;
    }
    // Rewrite lottie json file
    jsonData.assets = assets.filter((asset) => {
      return !asset.p;
    });
    const atlasFile = JSON.stringify(res.info);
    (res as any).info = {
      ...res.info,
      imageFiles: res.imageFiles || [],
      atlasFile,
      jsonFile: JSON.stringify(jsonData)
    };
    return res;
  } catch (error) {
    return {
      code: 11,
      msg: "Parse lottie file error"
    };
  }
}
