import { Rect } from "../Rect";

export interface IMaxRectsBinPack {
  binWidth: number;
  binHeight: number;
  allowRotate: boolean;
  usedRectangles: Array<Rect>;
  freeRectangles: Array<Rect>;

  init(width: number, height: number, allowRotate: boolean): void;
  insert(width: number, height: number, method: number): Rect;
  insert2(rectangles: Array<Rect>, method: number): Array<Rect>;
}
