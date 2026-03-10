import { SphericalHarmonics3, TextureCube, TextureCubeFace } from "@galacean/engine";
import { WorkerManager } from "./WorkerManager";

/**
 * Bake irradiance into spherical harmonics3 and use WebWorker.
 * @remarks
 * http://www.ppsloan.org/publications/StupidSH36.pdf
 */
export class SphericalHarmonics3Baker {
  /**
   * Bake from Cube texture and use WebWorker.
   * @param texture - Cube texture
   * @param out - SH3 for output
   */
  static async fromTextureCube(texture: TextureCube, out: SphericalHarmonics3): Promise<SphericalHarmonics3> {
    const channelLength = 4;
    const textureSize = texture.width;

    // read pixel always return rgba
    const dataPX = new Uint16Array(textureSize * textureSize * channelLength);
    const dataNX = new Uint16Array(textureSize * textureSize * channelLength);
    const dataPY = new Uint16Array(textureSize * textureSize * channelLength);
    const dataNY = new Uint16Array(textureSize * textureSize * channelLength);
    const dataPZ = new Uint16Array(textureSize * textureSize * channelLength);
    const dataNZ = new Uint16Array(textureSize * textureSize * channelLength);
    texture.getPixelBuffer(TextureCubeFace.PositiveX, 0, 0, textureSize, textureSize, 0, dataPX);
    texture.getPixelBuffer(TextureCubeFace.NegativeX, 0, 0, textureSize, textureSize, 0, dataNX);
    texture.getPixelBuffer(TextureCubeFace.PositiveY, 0, 0, textureSize, textureSize, 0, dataPY);
    texture.getPixelBuffer(TextureCubeFace.NegativeY, 0, 0, textureSize, textureSize, 0, dataNY);
    texture.getPixelBuffer(TextureCubeFace.PositiveZ, 0, 0, textureSize, textureSize, 0, dataPZ);
    texture.getPixelBuffer(TextureCubeFace.NegativeZ, 0, 0, textureSize, textureSize, 0, dataNZ);
    const result = await WorkerManager.calculateSHFromTextureCube(
      dataPX,
      dataNX,
      dataPY,
      dataNY,
      dataPZ,
      dataNZ,
      textureSize
    );

    // Apply SH deringing (sinc windowing) to eliminate ringing artifacts
    const shArray = new Float32Array(result);
    windowSH(shArray);

    out.copyFromArray(shArray);
    return out;
  }
}

export function halfToFloat(halfBits: number): number {
  const sign = halfBits & 0x8000 ? -1 : 1;
  const exponent = (halfBits >> 10) & 0x1f;
  const mantissa = halfBits & 0x03ff;

  if (exponent === 0x1f) {
    return mantissa === 0 ? sign * Infinity : NaN;
  }

  if (exponent === 0) {
    return sign * 2 ** -14 * (mantissa / 1024);
  }

  return sign * 2 ** (exponent - 15) * (1 + mantissa / 1024);
}

export function addSH(direction: number[], color: number[], deltaSolidAngle: number, sh: Float32Array): void {
  const x = direction[0];
  const y = direction[1];
  const z = direction[2];
  const r = color[0] * deltaSolidAngle;
  const g = color[1] * deltaSolidAngle;
  const b = color[2] * deltaSolidAngle;

  // SH basis functions (real, orthonormal, 3 bands)
  const bv0 = 0.282095; // K(0,0) = 1/(2*sqrt(pi))
  const bv1 = -0.488603 * y; // K(1,1) * sqrt(2) * y * (-1)
  const bv2 = 0.488603 * z; // K(0,1) * z
  const bv3 = -0.488603 * x; // K(1,1) * sqrt(2) * x * (-1)
  const bv4 = 1.092548 * (x * y); // K(2,2) * sqrt(2) * xy
  const bv5 = -1.092548 * (y * z); // K(1,2) * sqrt(2) * yz * (-1)
  const bv6 = 0.315392 * (3 * z * z - 1); // K(0,2) * (3z²-1)
  const bv7 = -1.092548 * (x * z); // K(1,2) * sqrt(2) * xz * (-1)
  const bv8 = 0.546274 * (x * x - y * y); // K(2,2) * sqrt(2) * (x²-y²)

  (sh[0] += r * bv0), (sh[1] += g * bv0), (sh[2] += b * bv0);

  (sh[3] += r * bv1), (sh[4] += g * bv1), (sh[5] += b * bv1);
  (sh[6] += r * bv2), (sh[7] += g * bv2), (sh[8] += b * bv2);
  (sh[9] += r * bv3), (sh[10] += g * bv3), (sh[11] += b * bv3);

  (sh[12] += r * bv4), (sh[13] += g * bv4), (sh[14] += b * bv4);
  (sh[15] += r * bv5), (sh[16] += g * bv5), (sh[17] += b * bv5);
  (sh[18] += r * bv6), (sh[19] += g * bv6), (sh[20] += b * bv6);
  (sh[21] += r * bv7), (sh[22] += g * bv7), (sh[23] += b * bv7);
  (sh[24] += r * bv8), (sh[25] += g * bv8), (sh[26] += b * bv8);
}
// Exact solid angle of a cubemap texel projected onto the unit sphere.
// See: Manne Öhrström, "Cubemap Texel Solid Angle"
export function sphereQuadrantArea(x: number, y: number): number {
  return Math.atan2(x * y, Math.sqrt(x * x + y * y + 1));
}

export function solidAngle(dim: number, u: number, v: number): number {
  const iDim = 1.0 / dim;
  const s = ((u + 0.5) * 2 * iDim) - 1;
  const t = ((v + 0.5) * 2 * iDim) - 1;
  const x0 = s - iDim;
  const y0 = t - iDim;
  const x1 = s + iDim;
  const y1 = t + iDim;
  return sphereQuadrantArea(x0, y0) -
         sphereQuadrantArea(x0, y1) -
         sphereQuadrantArea(x1, y0) +
         sphereQuadrantArea(x1, y1);
}

/**
 * SH deringing via sinc windowing.
 * See: Peter-Pike Sloan, "Deringing Spherical Harmonics"
 * https://www.ppsloan.org/publications/shdering.pdf
 */

// SH index mapping for 3 bands: SHindex(m, l)
// l=0: [0]
// l=1: [1](m=-1), [2](m=0), [3](m=1)
// l=2: [4](m=-2), [5](m=-1), [6](m=0), [7](m=1), [8](m=2)
function shIndex(m: number, l: number): number {
  return l * (l + 1) + m;
}

function sincWindow(l: number, w: number): number {
  if (l === 0) return 1.0;
  if (l >= w) return 0.0;
  let x = (Math.PI * l) / w;
  x = Math.sin(x) / x;
  return Math.pow(x, 4);
}

// Rotate SH band 1 (3 coefficients) by rotation matrix M
function rotateSHBand1(band1: number[], M: number[][]): number[] {
  // invA1TimesK = {{0,-1,0},{0,0,1},{-1,0,0}}
  // invA1TimesK * band1
  const t0 = -band1[1];
  const t1 = band1[2];
  const t2 = -band1[0];

  // R1OverK: for each column MN of M, compute {-MN.y, MN.z, -MN.x}
  // then R1OverK * (invA1TimesK * band1)
  const r0 = (-M[0][1]) * t0 + (M[0][2]) * t1 + (-M[0][0]) * t2;
  const r1 = (-M[1][1]) * t0 + (M[1][2]) * t1 + (-M[1][0]) * t2;
  const r2 = (-M[2][1]) * t0 + (M[2][2]) * t1 + (-M[2][0]) * t2;
  return [r0, r1, r2];
}

// Rotate SH band 2 (5 coefficients) by rotation matrix M
function rotateSHBand2(band2: number[], M: number[][]): number[] {
  const M_SQRT_3 = 1.7320508076;
  const SQRT1_2 = Math.SQRT1_2;

  // invATimesK (5x5 matrix, rows)
  const invATimesK = [
    [0, 1, 2, 0, 0],
    [-1, 0, 0, 0, -2],
    [0, M_SQRT_3, 0, 0, 0],
    [1, 1, 0, -2, 0],
    [2, 1, 0, 0, 0]
  ];

  // project: vec3 s -> 5 SH2/k coefficients
  function project(s: number[]): number[] {
    return [
      s[1] * s[0],
      -(s[1] * s[2]),
      (1 / (2 * M_SQRT_3)) * (3 * s[2] * s[2] - 1),
      -(s[2] * s[0]),
      0.5 * (s[0] * s[0] - s[1] * s[1])
    ];
  }

  // 5 reference directions
  const N0 = [1, 0, 0];
  const N1 = [0, 0, 1];
  const N2 = [SQRT1_2, SQRT1_2, 0];
  const N3 = [SQRT1_2, 0, SQRT1_2];
  const N4 = [0, SQRT1_2, SQRT1_2];

  // Transform each reference direction by M and project
  function mulMat3Vec3(mat: number[][], v: number[]): number[] {
    return [
      mat[0][0] * v[0] + mat[1][0] * v[1] + mat[2][0] * v[2],
      mat[0][1] * v[0] + mat[1][1] * v[1] + mat[2][1] * v[2],
      mat[0][2] * v[0] + mat[1][2] * v[1] + mat[2][2] * v[2]
    ];
  }

  const MN0 = mulMat3Vec3(M, N0);
  const MN1 = mulMat3Vec3(M, N1);
  const MN2 = mulMat3Vec3(M, N2);
  const MN3 = mulMat3Vec3(M, N3);
  const MN4 = mulMat3Vec3(M, N4);

  // R2OverK: 5x5 where each row is project(MNi)
  const R2OverK = [project(MN0), project(MN1), project(MN2), project(MN3), project(MN4)];

  // invATimesK * band2 (5-vector)
  const t: number[] = [0, 0, 0, 0, 0];
  for (let i = 0; i < 5; i++) {
    for (let j = 0; j < 5; j++) {
      t[i] += invATimesK[i][j] * band2[j];
    }
  }

  // R2OverK * t
  const result: number[] = [0, 0, 0, 0, 0];
  for (let i = 0; i < 5; i++) {
    for (let j = 0; j < 5; j++) {
      result[i] += R2OverK[i][j] * t[j];
    }
  }
  return result;
}

// Find the minimum value of the SH reconstruction (single channel, 9 coefficients)
// Used to determine if windowing is needed
function shMin(f: number[]): number {
  const M_SQRT_PI = 1.7724538509;
  const M_SQRT_3 = 1.7320508076;
  const M_SQRT_5 = 2.2360679775;
  const M_SQRT_15 = 3.8729833462;
  const A = [
    1.0 / (2.0 * M_SQRT_PI),
    -M_SQRT_3 / (2.0 * M_SQRT_PI),
    M_SQRT_3 / (2.0 * M_SQRT_PI),
    -M_SQRT_3 / (2.0 * M_SQRT_PI),
    M_SQRT_15 / (2.0 * M_SQRT_PI),
    -M_SQRT_15 / (2.0 * M_SQRT_PI),
    M_SQRT_5 / (4.0 * M_SQRT_PI),
    -M_SQRT_15 / (2.0 * M_SQRT_PI),
    M_SQRT_15 / (4.0 * M_SQRT_PI)
  ];

  // Rotate SH to align Z with the optimal linear direction
  const len = Math.sqrt(f[3] * f[3] + f[1] * f[1] + f[2] * f[2]);
  if (len < 1e-8) return A[0] * f[0]; // degenerate case

  const dirX = -f[3] / len;
  const dirY = -f[1] / len;
  const dirZ = f[2] / len;

  // z_axis = -dir
  const zx = -dirX, zy = -dirY, zz = -dirZ;
  // x_axis = normalize(cross(z_axis, {0,1,0}))
  let xx = zz, xy = 0, xz = -zx;
  const xLen = Math.sqrt(xx * xx + xz * xz);
  if (xLen < 1e-8) {
    xx = 1; xy = 0; xz = 0;
  } else {
    xx /= xLen; xz /= xLen;
  }
  // y_axis = cross(x_axis, z_axis)
  const yx = xy * zz - xz * zy;
  const yy = xz * zx - xx * zz;
  const yz = xx * zy - xy * zx;

  // M = transpose({x_axis, y_axis, -z_axis})
  const M: number[][] = [
    [xx, yx, -zx],
    [xy, yy, -zy],
    [xz, yz, -zz]
  ];

  // Rotate SH
  const band1 = rotateSHBand1([f[1], f[2], f[3]], M);
  const band2 = rotateSHBand2([f[4], f[5], f[6], f[7], f[8]], M);
  const rf = [f[0], band1[0], band1[1], band1[2], band2[0], band2[1], band2[2], band2[3], band2[4]];

  // Find min for |m| = 2
  const m2max = A[8] * Math.sqrt(rf[8] * rf[8] + rf[4] * rf[4]);

  // Find min of zonal harmonics + |m|=2
  const a = 3 * A[6] * rf[6] + m2max;
  const b = A[2] * rf[2];
  const c = A[0] * rf[0] - A[6] * rf[6] - m2max;

  const zmin = -b / (2.0 * a);
  const m0minZ = a * zmin * zmin + b * zmin + c;
  const m0minB = Math.min(a + b + c, a - b + c);
  const m0min = (a > 0 && zmin >= -1 && zmin <= 1) ? m0minZ : m0minB;

  // Find min for l=2, |m|=1
  const d = A[4] * Math.sqrt(rf[5] * rf[5] + rf[7] * rf[7]);

  let minimum = m0min - 0.5 * d;
  if (minimum < 0) {
    // Newton's method to find exact minimum
    const func = (x: number) => (a * x * x + b * x + c) + (d * x * Math.sqrt(1 - x * x));
    const increment = (x: number) => {
      const x2 = x * x;
      const sqrt1mx2 = Math.sqrt(1 - x2);
      return (x2 - 1) * (d - 2 * d * x2 + (b + 2 * a * x) * sqrt1mx2)
        / (3 * d * x - 2 * d * x2 * x - 2 * a * Math.pow(1 - x2, 1.5));
    };

    let z = -Math.SQRT1_2;
    let dz: number;
    do {
      minimum = func(z);
      dz = increment(z);
      z = z - dz;
    } while (Math.abs(z) <= 1 && Math.abs(dz) > 1e-5);

    if (Math.abs(z) > 1) {
      minimum = Math.min(func(1), func(-1));
    }
  }
  return minimum;
}

// Apply windowing with given cutoff
function applyWindowing(f: number[], cutoff: number): number[] {
  const numBands = 3;
  const result = f.slice();
  for (let l = 0; l < numBands; l++) {
    const w = sincWindow(l, cutoff);
    result[shIndex(0, l)] *= w;
    for (let m = 1; m <= l; m++) {
      result[shIndex(-m, l)] *= w;
      result[shIndex(m, l)] *= w;
    }
  }
  return result;
}

/**
 * Auto-windowed SH deringing.
 * Uses binary search to find optimal sinc window cutoff that eliminates negative values.
 * Applied per-channel on the 27-element SH array (9 coefficients * 3 channels RGB).
 */
export function windowSH(sh: Float32Array): void {
  const numBands = 3;
  let cutoff = numBands * 4 + 1; // start at large band (13)

  // Process each RGB channel separately to find the tightest cutoff
  for (let channel = 0; channel < 3; channel++) {
    // Extract 9 coefficients for this channel
    const f: number[] = [];
    for (let i = 0; i < 9; i++) {
      f[i] = sh[i * 3 + channel];
    }

    // Binary search for optimal cutoff
    let l = numBands;
    let r = cutoff;
    for (let iter = 0; iter < 16 && l + 0.1 < r; iter++) {
      const m = 0.5 * (l + r);
      const windowed = applyWindowing(f, m);
      if (shMin(windowed) < 0) {
        r = m;
      } else {
        l = m;
      }
    }
    cutoff = Math.min(cutoff, l);
  }

  // Apply the final windowing to all channels
  for (let l = 0; l < numBands; l++) {
    const w = sincWindow(l, cutoff);
    for (let m = -l; m <= l; m++) {
      const idx = shIndex(m, l);
      sh[idx * 3] *= w;
      sh[idx * 3 + 1] *= w;
      sh[idx * 3 + 2] *= w;
    }
  }
}

export function scaleSH(array: Float32Array, scale: number): void {
  const src = array;
  (src[0] *= scale), (src[1] *= scale), (src[2] *= scale);
  (src[3] *= scale), (src[4] *= scale), (src[5] *= scale);
  (src[6] *= scale), (src[7] *= scale), (src[8] *= scale);
  (src[9] *= scale), (src[10] *= scale), (src[11] *= scale);
  (src[12] *= scale), (src[13] *= scale), (src[14] *= scale);
  (src[15] *= scale), (src[16] *= scale), (src[17] *= scale);
  (src[18] *= scale), (src[19] *= scale), (src[20] *= scale);
  (src[21] *= scale), (src[22] *= scale), (src[23] *= scale);
  (src[24] *= scale), (src[25] *= scale), (src[26] *= scale);
}

// SH computation with exact solid angle calculation.
export function decodeFaceSH(
  faceData: Uint16Array,
  faceIndex: TextureCubeFace,
  textureSize: number,
  lastSolidAngleSum: number,
  sh: Float32Array // length 27
): number {
  const channelLength = 4;
  const color = [];
  const direction = [];

  let solidAngleSum = lastSolidAngleSum;

  for (let y = 0; y < textureSize; y++) {
    for (let x = 0; x < textureSize; x++) {
      const dataOffset = y * textureSize * channelLength + x * channelLength;
      // Linear (half-float)
      color[0] = halfToFloat(faceData[dataOffset]);
      color[1] = halfToFloat(faceData[dataOffset + 1]);
      color[2] = halfToFloat(faceData[dataOffset + 2]);

      // Compute texel center in [-1, 1] range
      const iDim = 1.0 / textureSize;
      const u = ((x + 0.5) * 2 * iDim) - 1;
      const v = ((y + 0.5) * 2 * iDim) - 1;

      // Cubemap face directions (same convention as original)
      switch (faceIndex) {
        case 0: // +X
          direction[0] = 1;
          direction[1] = -v;
          direction[2] = -u;
          break;
        case 1: // -X
          direction[0] = -1;
          direction[1] = -v;
          direction[2] = u;
          break;
        case 2: // +Y
          direction[0] = u;
          direction[1] = 1;
          direction[2] = v;
          break;
        case 3: // -Y
          direction[0] = u;
          direction[1] = -1;
          direction[2] = -v;
          break;
        case 4: // +Z
          direction[0] = u;
          direction[1] = -v;
          direction[2] = 1;
          break;
        case 5: // -Z
          direction[0] = -u;
          direction[1] = -v;
          direction[2] = -1;
          break;
      }

      // Normalize direction
      const lengthSquared = direction[0] * direction[0] + direction[1] * direction[1] + direction[2] * direction[2];
      const directionLength = Math.sqrt(lengthSquared);
      direction[0] /= directionLength;
      direction[1] /= directionLength;
      direction[2] /= directionLength;

      // Exact solid angle via sphereQuadrantArea
      const sa = solidAngle(textureSize, x, y);
      solidAngleSum += sa;
      addSH(direction, color, sa, sh);
    }
  }

  return solidAngleSum;
}
