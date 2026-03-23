export interface PackingItem {
  name: string;
  src?: string | ArrayBuffer;
  type?: string;
  image?: HTMLImageElement;
  /** If trim is applied, the non-transparent bounding rect within the original image. */
  trimRect?: { x: number; y: number; w: number; h: number };
  /** Original image width before trim. */
  sourceWidth?: number;
  /** Original image height before trim. */
  sourceHeight?: number;
}
