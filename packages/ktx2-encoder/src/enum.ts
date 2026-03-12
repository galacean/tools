export const enum BasisTextureType {
  cBASISTexType2D,
  cBASISTexType2DArray,
  cBASISTexTypeCubemapArray,
  cBASISTexTypeVideoFrames,
  cBASISTexTypeVolume
}

/** image source type */
export const enum SourceType {
  RAW,
  PNG
}

/**
 * Maps to BasisU hdr_image_type (cHITRGBAHalfFloat, cHITRGBAFloat, cHITEXRImage, cHITHDRImage).
 */
export const enum HDRSourceType {
  RGBAHalfFloat = 0,
  RGBAFloat = 1,
  EXR = 3,
  HDR = 4,
}
