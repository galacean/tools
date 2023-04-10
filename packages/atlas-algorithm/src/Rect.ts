export class Rect {
  public x: number = 0;
  public y: number = 0;
  public width: number = 0;
  public height: number = 0;
  public name: string = "";
  public isRotated: boolean = false;

  constructor(x = 0, y = 0, width = 0, height = 0, name = "") {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.name = name;
  }

  clone() {
    return new Rect(
      this.x,
      this.y,
      this.width,
      this.height,
      `${this.name}-clone`
    );
  }

  isContainedIn(rect: Rect) {
    return (
      this.x >= rect.x &&
      this.y >= rect.y &&
      this.x + this.width <= rect.x + rect.width &&
      this.y + this.height <= rect.y + rect.height
    );
  }

  static isContainedIn(rectA: Rect, rectB: Rect) {
    return rectA.isContainedIn(rectB);
  }
}
