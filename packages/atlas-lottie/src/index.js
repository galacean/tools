const atlasTool = require("@galacean/tools-atlas");
const fetch = require("node-fetch");
const fs = require("fs");
const path = require("path");

function createImage(asset, dir) {
  const { id, p } = asset;

  const base64Data = p.replace(/^data:image\/.+;base64,/, "");
  const name = `${dir}/${id}.png`;

  fs.writeFile(name, base64Data, "base64", function (err) {
    err && console.log(err);
  });

  return name;
}

function createEmptyAtlas() {
  return {
    version: 0,
    format: 1,
    atlasItems: []
  };
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function writeLottieJson(data, dir, nm) {
  ensureDir(dir);
  const jsonFilePath = `${dir}/${nm}.json`;
  fs.writeFileSync(jsonFilePath, JSON.stringify(data));
  return jsonFilePath;
}

module.exports = async function transform(lottiePath, imagesPath, options = {}) {
  let rawData, data;

  if (lottiePath.startsWith("http://") || lottiePath.startsWith("https://")) {
    data = await fetch(lottiePath).then((res) => res.json());
  } else {
    rawData = fs.readFileSync(lottiePath);
  }

  try {
    if (rawData) {
      data = JSON.parse(rawData);
    }

    const { nm, assets } = data;
    const lottieAssets = Array.isArray(assets) ? assets : [];
    const { output } = options;

    const spritesDir = output ? `${output}/.sprites` : path.resolve(`.sprites`);
    const dir = output || path.resolve(nm);

    let images = [];

    if (imagesPath) {
      const files = fs.readdirSync(imagesPath);
      images = files.map((file) => `${imagesPath}/${file}`);
    } else {
      if (!fs.existsSync(spritesDir)) {
        fs.mkdirSync(spritesDir);
      }

      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir);
      }

      for (let i = 0, l = lottieAssets.length; i < l; i++) {
        const asset = lottieAssets[i];

        // sprite assets
        if (asset.p) {
          const image = createImage(asset, spritesDir);
          if (image) {
            images.push(image);
          }
        }
      }
    }

    if (images.length === 0) {
      if (fs.existsSync(spritesDir)) {
        fs.rmSync(spritesDir, { recursive: true, force: true });
      }

      data.assets = lottieAssets.filter((asset) => {
        return !asset.p;
      });

      const atlasFilePath = `${dir}/${nm}.atlas`;
      ensureDir(dir);
      fs.writeFileSync(atlasFilePath, JSON.stringify(createEmptyAtlas()));

      const jsonFilePath = writeLottieJson(data, dir, nm);
      return {
        code: 0,
        msg: "Pack atlas success!",
        info: {
          atlasFile: atlasFilePath,
          jsonFile: jsonFilePath
        }
      };
    }

    const res = await atlasTool.pack(images, {
      output: `${dir}/${nm}`,
      ...options
    });

    if (res.code !== 0) {
      console.log("Atlas Error:", res.msg);
      return res;
    }

    if (fs.existsSync(spritesDir)) {
      fs.rmSync(spritesDir, { recursive: true, force: true });
    }

    // Rewrite lottie json file
    data.assets = data.assets.filter((asset) => {
      return !asset.p;
    });

    const jsonFilePath = writeLottieJson(data, dir, nm);

    res.info.jsonFile = jsonFilePath;

    console.log("Pack atlas success!", res);

    return res;
  } catch (error) {
    return {
      code: 11,
      msg: "Parse lottie file error"
    };
  }
};
