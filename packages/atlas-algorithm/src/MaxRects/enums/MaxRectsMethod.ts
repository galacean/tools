export enum MaxRectsMethod {
  // /< -BSSF: Positions the Rectangle against the short side of a free Rectangle into which it fits the best.
  BestShortSideFit,
  // /< -BLSF: Positions the Rectangle against the long side of a free Rectangle into which it fits the best.
  BestLongSideFit,
  // /< -BAF: Positions the Rectangle into the smallest free Rectangle into which it fits.
  BestAreaFit,
  // /< -BL: Does the Tetris placement.
  BottomLeftRule,
  // /< -CP: Choosest the placement where the Rectangle touches other Rectangles as much as possible.
  ContactPointRule
}
