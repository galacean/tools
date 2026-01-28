export interface PackingItem {
  name: string;
  width: number;
  height: number;
  src?: string | ArrayBuffer;
  type?: string;
  image?: HTMLImageElement;
}
