export class Rect {
  x: number;
  y: number;
  width: number;
  height: number;
  name: string;
  isRotated: boolean = false;

  constructor(x = 0, y = 0, width = 0, height = 0, name = '') {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.name = name;
  }

  clone() {
    return new Rect(this.x, this.y, this.width, this.height, `${this.name}-clone`);
  }

  isContainedIn(rect: Rect) {
    return this.x >= rect.x && this.y >= rect.y
      && this.x + this.width <= rect.x + rect.width
      && this.y + this.height <= rect.y + rect.height;
  }

  static isContainedIn(rectA: Rect, rectB: Rect) {
    return rectA.isContainedIn(rectB);
  }
}

