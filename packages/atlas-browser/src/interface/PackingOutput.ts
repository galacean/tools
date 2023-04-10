/**
 * 打包的阶段产物
 */
export interface PackingOutput {
  msg?: string;
  code?: number;
  usage?: number;
  width?: number;
  height?: number;
  packedItem?: any[];
  info?: {
    imageFiles?: Array<ArrayBuffer>;
    atlasFile?: string;
  };
}
