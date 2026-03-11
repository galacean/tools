/**
 * SmartRectsBinPack
 *
 * A MaxRects-based bin packer with improved free-rect pruning and
 * deterministic selection, inspired by maxrects-packer optimizations.
 */
import { Rect } from "../Rect";
import { MaxRectsMethod } from "./enums/MaxRectsMethod";
import { IMaxRectsBinPack } from "./IMaxRectsBinPack";

interface Score {
  value: number;
}

export class SmartRectsBinPack implements IMaxRectsBinPack {
  binWidth: number;
  binHeight: number;
  allowRotate: boolean;
  usedRectangles: Array<Rect>;
  freeRectangles: Array<Rect>;

  constructor() {
    this.binWidth = 0;
    this.binHeight = 0;
    this.allowRotate = false;
    this.usedRectangles = [];
    this.freeRectangles = [];
  }

  init(width: number, height: number, allowRotate: boolean) {
    this.binWidth = width;
    this.binHeight = height;
    this.allowRotate = allowRotate || false;

    this.usedRectangles.length = 0;
    this.freeRectangles.length = 0;
    this.freeRectangles.push(new Rect(0, 0, width, height));
  }

  insert(width: number, height: number, method: number) {
    let newNode = new Rect();
    const score1: Score = { value: 0 };
    const score2: Score = { value: 0 };
    const logic = method || 0;
    const allowRotate = this.allowRotate;

    if (!this._canFit(width, height, allowRotate)) {
      return newNode;
    }

    switch (logic) {
      case MaxRectsMethod.BestShortSideFit:
        newNode = this._findPositionForNewNodeBestShortSideFit(width, height, score1, score2, allowRotate);
        break;
      case MaxRectsMethod.BottomLeftRule:
        newNode = this._findPositionForNewNodeBottomLeft(width, height, score1, score2, allowRotate);
        break;
      case MaxRectsMethod.ContactPointRule:
        newNode = this._findPositionForNewNodeContactPoint(width, height, score1, allowRotate);
        break;
      case MaxRectsMethod.BestLongSideFit:
        newNode = this._findPositionForNewNodeBestLongSideFit(width, height, score2, score1, allowRotate);
        break;
      case MaxRectsMethod.BestAreaFit:
        newNode = this._findPositionForNewNodeBestAreaFit(width, height, score1, score2, allowRotate);
        break;
      default:
        break;
    }

    if (newNode.height === 0) {
      return newNode;
    }

    this._placeRectangle(newNode);
    return newNode;
  }

  insert2(rectangles: Array<Rect>, method: number) {
    const res: Array<Rect> = [];
    const logic = method || 0;
    while (rectangles.length > 0) {
      let bestScore1 = Infinity;
      let bestScore2 = Infinity;
      let bestRectangleIndex = -1;
      let bestNode = new Rect();
      let bestSortKey = -Infinity;

      for (let i = 0; i < rectangles.length; i++) {
        const rect = rectangles[i];
        const allowRotate = this._getAllowRotate(rect);

        if (!this._canFit(rect.width, rect.height, allowRotate)) {
          continue;
        }

        const score1 = { value: 0 };
        const score2 = { value: 0 };
        const newNode = this._scoreRectangle(rect.width, rect.height, logic, score1, score2, allowRotate);

        if (score1.value < bestScore1 || (score1.value === bestScore1 && score2.value < bestScore2)) {
          bestScore1 = score1.value;
          bestScore2 = score2.value;
          bestNode = newNode;
          bestRectangleIndex = i;
          bestSortKey = this._getSortKey(rect, logic);
        } else if (
          bestRectangleIndex !== -1 &&
          score1.value !== Infinity &&
          score2.value !== Infinity &&
          score1.value === bestScore1 &&
          score2.value === bestScore2 &&
          this._getSortKey(rect, logic) > bestSortKey
        ) {
          bestNode = newNode;
          bestRectangleIndex = i;
          bestSortKey = this._getSortKey(rect, logic);
        }
      }

      if (bestRectangleIndex === -1) {
        return res;
      }

      this._placeRectangle(bestNode);
      const rect = rectangles.splice(bestRectangleIndex, 1)[0];
      rect.x = bestNode.x;
      rect.y = bestNode.y;
      rect.isRotated = bestNode.isRotated;
      res.push(rect);
    }
    return res;
  }

  private _placeRectangle(node: Rect) {
    let numRectanglesToProcess = this.freeRectangles.length;
    for (let i = 0; i < numRectanglesToProcess; i++) {
      if (this._splitFreeNode(this.freeRectangles[i], node)) {
        this.freeRectangles.splice(i, 1);
        i--;
        numRectanglesToProcess--;
      }
    }

    this._purgeFreeList();
    this._pruneFreeList();
    this.usedRectangles.push(node);
  }

  private _scoreRectangle(
    width: number,
    height: number,
    method: number,
    score1: Score,
    score2: Score,
    allowRotate: boolean
  ) {
    let newNode = new Rect();
    score1.value = Infinity;
    score2.value = Infinity;

    switch (method) {
      case MaxRectsMethod.BestShortSideFit:
        newNode = this._findPositionForNewNodeBestShortSideFit(width, height, score1, score2, allowRotate);
        break;
      case MaxRectsMethod.BottomLeftRule:
        newNode = this._findPositionForNewNodeBottomLeft(width, height, score1, score2, allowRotate);
        break;
      case MaxRectsMethod.ContactPointRule:
        newNode = this._findPositionForNewNodeContactPoint(width, height, score1, allowRotate);
        score1.value = -score1.value;
        break;
      case MaxRectsMethod.BestLongSideFit:
        newNode = this._findPositionForNewNodeBestLongSideFit(width, height, score2, score1, allowRotate);
        break;
      case MaxRectsMethod.BestAreaFit:
        newNode = this._findPositionForNewNodeBestAreaFit(width, height, score1, score2, allowRotate);
        break;
      default:
        break;
    }

    if (newNode.height === 0) {
      score1.value = Infinity;
      score2.value = Infinity;
    }
    return newNode;
  }

  private _findPositionForNewNodeBottomLeft(
    width: number,
    height: number,
    bestY: Score,
    bestX: Score,
    allowRotate: boolean
  ) {
    const freeRectangles = this.freeRectangles;
    const bestNode = new Rect();

    bestY.value = Infinity;
    bestX.value = Infinity;
    let rect;
    let topSideY;
    for (let i = 0; i < freeRectangles.length; i++) {
      rect = freeRectangles[i];
      if (rect.width >= width && rect.height >= height) {
        topSideY = rect.y + height;
        if (topSideY < bestY.value || (topSideY === bestY.value && rect.x < bestX.value)) {
          bestNode.x = rect.x;
          bestNode.y = rect.y;
          bestNode.width = width;
          bestNode.height = height;
          bestNode.isRotated = false;
          bestY.value = topSideY;
          bestX.value = rect.x;
        }
      }
      if (allowRotate && rect.width >= height && rect.height >= width) {
        topSideY = rect.y + width;
        if (topSideY < bestY.value || (topSideY === bestY.value && rect.x < bestX.value)) {
          bestNode.x = rect.x;
          bestNode.y = rect.y;
          bestNode.width = height;
          bestNode.height = width;
          bestNode.isRotated = true;
          bestY.value = topSideY;
          bestX.value = rect.x;
        }
      }
    }
    return bestNode;
  }

  private _findPositionForNewNodeBestShortSideFit(
    width: number,
    height: number,
    bestShortSideFit: Score,
    bestLongSideFit: Score,
    allowRotate: boolean
  ) {
    const freeRectangles = this.freeRectangles;
    const bestNode = new Rect();

    bestShortSideFit.value = Infinity;

    let rect;
    let leftoverHoriz;
    let leftoverVert;
    let shortSideFit;
    let longSideFit;

    for (let i = 0; i < freeRectangles.length; i++) {
      rect = freeRectangles[i];
      if (rect.width >= width && rect.height >= height) {
        leftoverHoriz = Math.abs(rect.width - width);
        leftoverVert = Math.abs(rect.height - height);
        shortSideFit = Math.min(leftoverHoriz, leftoverVert);
        longSideFit = Math.max(leftoverHoriz, leftoverVert);

        if (
          shortSideFit < bestShortSideFit.value ||
          (shortSideFit === bestShortSideFit.value && longSideFit < bestLongSideFit.value)
        ) {
          bestNode.x = rect.x;
          bestNode.y = rect.y;
          bestNode.width = width;
          bestNode.height = height;
          bestNode.isRotated = false;
          bestShortSideFit.value = shortSideFit;
          bestLongSideFit.value = longSideFit;
        }
      }
      if (allowRotate && rect.width >= height && rect.height >= width) {
        const flippedLeftoverHoriz = Math.abs(rect.width - height);
        const flippedLeftoverVert = Math.abs(rect.height - width);
        const flippedShortSideFit = Math.min(flippedLeftoverHoriz, flippedLeftoverVert);
        const flippedLongSideFit = Math.max(flippedLeftoverHoriz, flippedLeftoverVert);

        if (
          flippedShortSideFit < bestShortSideFit.value ||
          (flippedShortSideFit === bestShortSideFit.value && flippedLongSideFit < bestLongSideFit.value)
        ) {
          bestNode.x = rect.x;
          bestNode.y = rect.y;
          bestNode.width = height;
          bestNode.height = width;
          bestNode.isRotated = true;
          bestShortSideFit.value = flippedShortSideFit;
          bestLongSideFit.value = flippedLongSideFit;
        }
      }
    }

    return bestNode;
  }

  private _findPositionForNewNodeBestLongSideFit(
    width: number,
    height: number,
    bestShortSideFit: Score,
    bestLongSideFit: Score,
    allowRotate: boolean
  ) {
    const freeRectangles = this.freeRectangles;
    const bestNode = new Rect();
    bestLongSideFit.value = Infinity;
    let rect;

    let leftoverHoriz;
    let leftoverVert;
    let shortSideFit;
    let longSideFit;
    for (let i = 0; i < freeRectangles.length; i++) {
      rect = freeRectangles[i];
      if (rect.width >= width && rect.height >= height) {
        leftoverHoriz = Math.abs(rect.width - width);
        leftoverVert = Math.abs(rect.height - height);
        shortSideFit = Math.min(leftoverHoriz, leftoverVert);
        longSideFit = Math.max(leftoverHoriz, leftoverVert);

        if (
          longSideFit < bestLongSideFit.value ||
          (longSideFit === bestLongSideFit.value && shortSideFit < bestShortSideFit.value)
        ) {
          bestNode.x = rect.x;
          bestNode.y = rect.y;
          bestNode.width = width;
          bestNode.height = height;
          bestNode.isRotated = false;
          bestShortSideFit.value = shortSideFit;
          bestLongSideFit.value = longSideFit;
        }
      }

      if (allowRotate && rect.width >= height && rect.height >= width) {
        leftoverHoriz = Math.abs(rect.width - height);
        leftoverVert = Math.abs(rect.height - width);
        shortSideFit = Math.min(leftoverHoriz, leftoverVert);
        longSideFit = Math.max(leftoverHoriz, leftoverVert);

        if (
          longSideFit < bestLongSideFit.value ||
          (longSideFit === bestLongSideFit.value && shortSideFit < bestShortSideFit.value)
        ) {
          bestNode.x = rect.x;
          bestNode.y = rect.y;
          bestNode.width = height;
          bestNode.height = width;
          bestNode.isRotated = true;
          bestShortSideFit.value = shortSideFit;
          bestLongSideFit.value = longSideFit;
        }
      }
    }
    return bestNode;
  }

  private _findPositionForNewNodeBestAreaFit(
    width: number,
    height: number,
    bestAreaFit: Score,
    bestShortSideFit: Score,
    allowRotate: boolean
  ) {
    const freeRectangles = this.freeRectangles;
    const bestNode = new Rect();

    bestAreaFit.value = Infinity;

    let rect;
    let leftoverHoriz;
    let leftoverVert;
    let shortSideFit;
    let areaFit;

    for (let i = 0; i < freeRectangles.length; i++) {
      rect = freeRectangles[i];
      areaFit = rect.width * rect.height - width * height;

      if (rect.width >= width && rect.height >= height) {
        leftoverHoriz = Math.abs(rect.width - width);
        leftoverVert = Math.abs(rect.height - height);
        shortSideFit = Math.min(leftoverHoriz, leftoverVert);

        if (areaFit < bestAreaFit.value || (areaFit === bestAreaFit.value && shortSideFit < bestShortSideFit.value)) {
          bestNode.x = rect.x;
          bestNode.y = rect.y;
          bestNode.width = width;
          bestNode.height = height;
          bestNode.isRotated = false;
          bestShortSideFit.value = shortSideFit;
          bestAreaFit.value = areaFit;
        }
      }

      if (allowRotate && rect.width >= height && rect.height >= width) {
        leftoverHoriz = Math.abs(rect.width - height);
        leftoverVert = Math.abs(rect.height - width);
        shortSideFit = Math.min(leftoverHoriz, leftoverVert);

        if (areaFit < bestAreaFit.value || (areaFit === bestAreaFit.value && shortSideFit < bestShortSideFit.value)) {
          bestNode.x = rect.x;
          bestNode.y = rect.y;
          bestNode.width = height;
          bestNode.height = width;
          bestNode.isRotated = true;
          bestShortSideFit.value = shortSideFit;
          bestAreaFit.value = areaFit;
        }
      }
    }
    return bestNode;
  }

  private _commonIntervalLength(i1start: number, i1end: number, i2start: number, i2end: number) {
    if (i1end < i2start || i2end < i1start) {
      return 0;
    }
    return Math.min(i1end, i2end) - Math.max(i1start, i2start);
  }

  private _contactPointScoreNode(x: number, y: number, width: number, height: number) {
    const usedRectangles = this.usedRectangles;
    let score = 0;

    if (x === 0 || x + width === this.binWidth) score += height;
    if (y === 0 || y + height === this.binHeight) score += width;
    let rect;
    for (let i = 0; i < usedRectangles.length; i++) {
      rect = usedRectangles[i];
      if (rect.x === x + width || rect.x + rect.width === x)
        score += this._commonIntervalLength(rect.y, rect.y + rect.height, y, y + height);
      if (rect.y === y + height || rect.y + rect.height === y)
        score += this._commonIntervalLength(rect.x, rect.x + rect.width, x, x + width);
    }
    return score;
  }

  private _findPositionForNewNodeContactPoint(
    width: number,
    height: number,
    bestContactScore: Score,
    allowRotate: boolean
  ) {
    const freeRectangles = this.freeRectangles;
    const bestNode = new Rect();

    bestContactScore.value = -1;

    let rect;
    let score;
    for (let i = 0; i < freeRectangles.length; i++) {
      rect = freeRectangles[i];
      if (rect.width >= width && rect.height >= height) {
        score = this._contactPointScoreNode(rect.x, rect.y, width, height);
        if (score > bestContactScore.value) {
          bestNode.x = rect.x;
          bestNode.y = rect.y;
          bestNode.width = width;
          bestNode.height = height;
          bestNode.isRotated = false;
          bestContactScore.value = score;
        }
      }
      if (allowRotate && rect.width >= height && rect.height >= width) {
        score = this._contactPointScoreNode(rect.x, rect.y, height, width);
        if (score > bestContactScore.value) {
          bestNode.x = rect.x;
          bestNode.y = rect.y;
          bestNode.width = height;
          bestNode.height = width;
          bestNode.isRotated = true;
          bestContactScore.value = score;
        }
      }
    }
    return bestNode;
  }

  private _splitFreeNode(freeNode: Rect, usedNode: Rect) {
    const freeRectangles = this.freeRectangles;
    if (
      usedNode.x >= freeNode.x + freeNode.width ||
      usedNode.x + usedNode.width <= freeNode.x ||
      usedNode.y >= freeNode.y + freeNode.height ||
      usedNode.y + usedNode.height <= freeNode.y
    )
      return false;

    let newNode;
    if (usedNode.x < freeNode.x + freeNode.width && usedNode.x + usedNode.width > freeNode.x) {
      if (usedNode.y > freeNode.y && usedNode.y < freeNode.y + freeNode.height) {
        newNode = freeNode.clone();
        newNode.height = usedNode.y - newNode.y;
        if (newNode.width > 0 && newNode.height > 0) {
          freeRectangles.push(newNode);
        }
      }

      if (usedNode.y + usedNode.height < freeNode.y + freeNode.height) {
        newNode = freeNode.clone();
        newNode.y = usedNode.y + usedNode.height;
        newNode.height = freeNode.y + freeNode.height - (usedNode.y + usedNode.height);
        if (newNode.width > 0 && newNode.height > 0) {
          freeRectangles.push(newNode);
        }
      }
    }

    if (usedNode.y < freeNode.y + freeNode.height && usedNode.y + usedNode.height > freeNode.y) {
      if (usedNode.x > freeNode.x && usedNode.x < freeNode.x + freeNode.width) {
        newNode = freeNode.clone();
        newNode.width = usedNode.x - newNode.x;
        if (newNode.width > 0 && newNode.height > 0) {
          freeRectangles.push(newNode);
        }
      }

      if (usedNode.x + usedNode.width < freeNode.x + freeNode.width) {
        newNode = freeNode.clone();
        newNode.x = usedNode.x + usedNode.width;
        newNode.width = freeNode.x + freeNode.width - (usedNode.x + usedNode.width);
        if (newNode.width > 0 && newNode.height > 0) {
          freeRectangles.push(newNode);
        }
      }
    }

    return true;
  }

  private _pruneFreeList() {
    const freeRectangles = this.freeRectangles;
    let i = 0;
    while (i < freeRectangles.length) {
      let j = i + 1;
      const rectA = freeRectangles[i];
      while (j < freeRectangles.length) {
        const rectB = freeRectangles[j];
        if (Rect.isContainedIn(rectA, rectB)) {
          freeRectangles.splice(i, 1);
          i--;
          break;
        }
        if (Rect.isContainedIn(rectB, rectA)) {
          freeRectangles.splice(j, 1);
          j--;
        }
        j++;
      }
      i++;
    }
  }

  private _purgeFreeList() {
    const freeRectangles = this.freeRectangles;
    for (let i = freeRectangles.length - 1; i >= 0; i--) {
      const rect = freeRectangles[i];
      if (rect.width <= 0 || rect.height <= 0) {
        freeRectangles.splice(i, 1);
      }
    }
  }

  private _canFit(width: number, height: number, allowRotate: boolean) {
    if (width <= this.binWidth && height <= this.binHeight) return true;
    if (allowRotate && height <= this.binWidth && width <= this.binHeight) return true;
    return false;
  }

  private _getAllowRotate(rect: Rect) {
    const anyRect = rect as any;
    if (typeof anyRect.allowRotate === "boolean") return anyRect.allowRotate;
    if (typeof anyRect.allowRotation === "boolean") return anyRect.allowRotation;
    return this.allowRotate;
  }

  private _getSortKey(rect: Rect, method: number) {
    if (method === MaxRectsMethod.BestAreaFit) {
      return rect.width * rect.height;
    }
    return Math.max(rect.width, rect.height);
  }
}
