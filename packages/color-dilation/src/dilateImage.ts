const clamp = function (value: number, min: number, max: number): number {
  if (value >= max) {
    return max;
  } else if (value <= min) {
    return min;
  } else {
    return value;
  }
};

/**
 * to solve letterboxing caused by sudden alpha value change between pixels
 * @param imageData image data to process
 * @param range alpha range for process
 * @param alpha new alpha value
 * @returns processed imageData
 */
export function dilateImage(imageData: ImageData, range: number, alpha: number): ImageData {
  const width = imageData.width;
  const height = imageData.height;
  const data = imageData.data;

  range = clamp(range, 0, 255);
  alpha = clamp(alpha, 0, 255);

  let queue: number[][] = [];
  const visited: number[][] = [];

  function fullScan(callback: (x: number, y: number) => any) {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        callback(x, y);
      }
    }
  }

  function neighborScan(x: number, y: number, callback: (x: number, y: number) => any) {
    const neighborArray = [
      [x - 1, y],
      [x + 1, y],
      [x, y + 1],
      [x, y - 1]
    ];

    for (const pos of neighborArray) {
      const x0 = pos[0],
        y0 = pos[1];
      if (x0 >= 0 && x0 < width && y0 >= 0 && y0 < height) {
        callback(x0, y0);
      }
    }
  }

  function getPixelIndex(x: number, y: number): number {
    return (y * width + x) * 4;
  }

  function getPixelRedData(x: number, y: number) {
    const idx = getPixelIndex(x, y);
    return data[idx];
  }

  function getPixelGreenData(x: number, y: number) {
    const idx = getPixelIndex(x, y);
    return data[idx + 1];
  }

  function getPixelBlueData(x: number, y: number) {
    const idx = getPixelIndex(x, y);
    return data[idx + 2];
  }

  function getPixelAlphaData(x: number, y: number) {
    const idx = getPixelIndex(x, y);
    return data[idx + 3];
  }

  fullScan((x, y) => {
    if (getPixelAlphaData(x, y) !== 0) {
      neighborScan(x, y, (x, y) => {
        const neighborArray = [
          [x - 1, y],
          [x + 1, y],
          [x, y + 1],
          [x, y - 1]
        ];
        if (getPixelAlphaData(x, y) !== 0) {
          for (const pos of neighborArray) {
            const x0 = pos[0],
              y0 = pos[1];

            if (x0 >= 0 && x0 < width && y0 >= 0 && y0 < height && getPixelAlphaData(x0, y0) === 0) {
              queue.push([x, y]);
            }
          }
        }
      });
    }
  });

  while (queue.length > 0) {
    const nextLayer = [];

    for (const pos of queue) {
      const x = pos[0],
        y = pos[1];
      const neighborArray = [
        [x - 1, y],
        [x + 1, y],
        [x, y + 1],
        [x, y - 1]
      ];

      for (const currPos of neighborArray) {
        const x0 = currPos[0],
          y0 = currPos[1];

        if (x0 >= 0 && x0 < width && y0 >= 0 && y0 < height && getPixelAlphaData(x0, y0) <= range) {
          const idx = getPixelIndex(x0, y0);
          data[idx + 3] = 255;

          data[idx] = getPixelRedData(x, y);
          data[idx + 1] = getPixelGreenData(x, y);
          data[idx + 2] = getPixelBlueData(x, y);
          if (nextLayer.indexOf(currPos) === -1) {
            nextLayer.push(currPos);
            visited.push(currPos);
          }
        }
      }
    }
    queue = nextLayer;
  }
  for (let i = 0; i < visited.length; i++) {
    const x0 = visited[i][0],
      y0 = visited[i][1];
    const idx = getPixelIndex(x0, y0);
    data[idx + 3] = alpha;
  }

  imageData.data.set(data);
  return imageData;
}
