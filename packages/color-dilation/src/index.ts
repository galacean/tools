import { dilateImage } from "./dilateImage";

let newCanvas: HTMLCanvasElement;

/**
 * options for image process
 */
interface Option {
  /**
   * the alpha range for process, default 10
   */
  range: number;
  /**
   * the new alpha value, default 0
   */
  alpha: number;
}

/**
 *
 * @param fileBuffer arraybuffer of the image
 * @param options the param for image process
 * @param canvas the canvas
 * @returns processed blob
 */
export async function dilateColor(
  fileBuffer: ArrayBuffer,
  options: Option = { range: 10, alpha: 0 },
  canvas: HTMLCanvasElement = newCanvas
): Promise<Blob | null> {
  const imgLoaded = await new Promise<HTMLImageElement>((resolve) => {
    const img = new Image();
    img.crossOrigin = "*";
    img.src = URL.createObjectURL(new Blob([fileBuffer]));
    img.onload = () => {
      resolve(img);
    };
  });

  if (!canvas) {
    canvas = document.createElement("canvas");
  }
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    console.log("cannot not get 2d context");
    return null;
  }

  canvas.width = imgLoaded.width;
  canvas.height = imgLoaded.height;
  ctx.clearRect(0, 0, imgLoaded.width, imgLoaded.height);
  ctx.drawImage(imgLoaded, 0, 0, imgLoaded.width, imgLoaded.height);
  const imageData = ctx.getImageData(0, 0, imgLoaded.width, imgLoaded.height);
  const range = options.range;
  const alpha = options.alpha;

  const processedData = dilateImage(imageData, range, alpha);
  ctx.putImageData(processedData, 0, 0);
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      resolve(blob);
    });
  });
}
