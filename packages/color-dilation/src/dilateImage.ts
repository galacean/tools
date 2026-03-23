const clamp = function (value: number, min: number, max: number): number {
  if (value >= max) return max;
  if (value <= min) return min;
  return value;
};

/**
 * Pure BFS color dilation on raw RGBA pixel data.
 * No browser/platform dependencies — works with any Uint8Array of RGBA pixels.
 *
 * Spreads opaque pixel colors into adjacent transparent pixels to prevent
 * dark-edge artifacts caused by sudden alpha transitions.
 *
 * @param data   Raw RGBA pixel data (4 bytes per pixel).
 * @param width  Image width in pixels.
 * @param height Image height in pixels.
 * @param range  Alpha threshold: pixels with alpha <= range are candidates for dilation.
 * @param alpha  The alpha value assigned to dilated pixels.
 * @returns A new Uint8Array with the dilated pixel data.
 */
export function dilateImage(
  data: Uint8Array | Uint8ClampedArray,
  width: number,
  height: number,
  range: number,
  alpha: number
): Uint8Array {
  const result = new Uint8Array(data);
  range = clamp(range, 0, 255);
  alpha = clamp(alpha, 0, 255);

  const getIdx = (x: number, y: number) => (y * width + x) * 4;
  const neighbors: [number, number][] = [[-1, 0], [1, 0], [0, -1], [0, 1]];

  // Find opaque edge pixels (opaque pixels with at least one transparent neighbor)
  const queue: [number, number][] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (result[getIdx(x, y) + 3] === 0) continue;
      for (const [dx, dy] of neighbors) {
        const nx = x + dx, ny = y + dy;
        if (nx >= 0 && nx < width && ny >= 0 && ny < height && result[getIdx(nx, ny) + 3] === 0) {
          queue.push([x, y]);
          break;
        }
      }
    }
  }

  // BFS: spread edge pixel colors to transparent neighbors
  const visited = new Set<number>();
  const dilatedPixels: number[] = [];

  while (queue.length > 0) {
    const nextLayer: [number, number][] = [];
    for (const [x, y] of queue) {
      for (const [dx, dy] of neighbors) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
        const nIdx = getIdx(nx, ny);
        if (result[nIdx + 3] > range) continue;
        const key = ny * width + nx;
        if (visited.has(key)) continue;
        visited.add(key);

        const srcIdx = getIdx(x, y);
        result[nIdx] = result[srcIdx];
        result[nIdx + 1] = result[srcIdx + 1];
        result[nIdx + 2] = result[srcIdx + 2];
        result[nIdx + 3] = 255;

        nextLayer.push([nx, ny]);
        dilatedPixels.push(nIdx);
      }
    }
    queue.length = 0;
    for (let i = 0; i < nextLayer.length; i++) queue.push(nextLayer[i]);
  }

  // Set dilated pixels to the target alpha
  for (const idx of dilatedPixels) {
    result[idx + 3] = alpha;
  }

  return result;
}
