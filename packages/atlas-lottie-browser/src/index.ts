import { pack } from "@galacean/tools-atlas-browser";

export async function transform(lottie, images, options = {}) {
    try {
        const jsonData = JSON.parse(lottie);
        const { assets } = jsonData;
        const lottieImages = [];
        for (let i = 0, l = assets.length; i < l; i++) {
            const asset = assets[i];
            const { p } = asset;
            // sprite assets
            p &&
                lottieImages.push({
                    name: asset.id,
                    src: p,
                });
        }
        const res = await pack(lottieImages, {
            width: 2048,
            height: 2048,
            ...options,
        });
        if (res.code !== 0) {
            console.log("Atlas Error:", res.msg);
            return res;
        }
        // Rewrite lottie json file
        jsonData.assets = assets.filter((asset) => {
            return !asset.p;
        });
        // @ts-ignore
        res.info.jsonFile = JSON.stringify(jsonData);
        return res;
    }
    catch (error) {
        return {
            code: 11,
            msg: "Parse lottie file error",
        };
    }
}
;
