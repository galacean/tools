import { dilateImage } from "./dilateImage";

/**
 * Perform color dilation on an image buffer.
 *
 * Automatically detects the runtime environment:
 *   - Browser: decodes via Canvas2D, re-encodes to PNG Blob
 *   - Node.js: decodes via sharp (auto-detected), re-encodes to PNG Blob
 *
 * Same API for both environments — caller doesn't need to know.
 */
export async function dilateColor(
  fileBuffer: ArrayBuffer,
  options: { range: number; alpha: number } = { range: 10, alpha: 0 }
): Promise<Blob | null> {
  const isBrowser = typeof document !== "undefined";
  if (isBrowser) {
    return _dilateColorBrowser(fileBuffer, options);
  } else {
    return _dilateColorNode(fileBuffer, options);
  }
}

async function _dilateColorBrowser(
  fileBuffer: ArrayBuffer,
  options: { range: number; alpha: number }
): Promise<Blob | null> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "*";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = URL.createObjectURL(new Blob([fileBuffer]));
  });

  const canvas = document.createElement("canvas");
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.drawImage(img, 0, 0);
  const imageData = ctx.getImageData(0, 0, img.width, img.height);
  const processed = dilateImage(
    new Uint8Array(imageData.data.buffer),
    img.width,
    img.height,
    options.range,
    options.alpha
  );

  ctx.putImageData(new ImageData(new Uint8ClampedArray(processed), img.width, img.height), 0, 0);
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob));
  });
}

async function _dilateColorNode(
  fileBuffer: ArrayBuffer,
  options: { range: number; alpha: number }
): Promise<Blob | null> {
  const sharp = (await import("sharp")).default;
  const { data, info } = await sharp(Buffer.from(fileBuffer))
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const processed = dilateImage(
    new Uint8Array(data.buffer, data.byteOffset, data.byteLength),
    info.width,
    info.height,
    options.range,
    options.alpha
  );

  const pngBuffer = await sharp(Buffer.from(processed), {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .png()
    .toBuffer();

  return new Blob([new Uint8Array(pngBuffer)]);
}
