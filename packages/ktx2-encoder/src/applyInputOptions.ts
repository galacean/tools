import { IEncodeOptions, IBasisEncoder } from "./type";
import { DefaultOptions } from "./utils";

/**
 * Applies public encoding options to a Basis Universal encoder instance.
 * @param options - Partial encoding options.
 * @param encoder - Initialized Basis Universal encoder instance.
 * @returns Nothing.
 * @throws When legacy color-space options contradict each other.
 */
export function applyInputOptions(options: Partial<IEncodeOptions> = {}, encoder: IBasisEncoder) {
  const isNormalMap = options.isNormalMap === true;
  const colorSpaceOptions = [options.isSRGB, options.isPerceptual, options.isSetKTX2SRGBTransferFunc].filter(
    (value): value is boolean => value !== undefined
  );
  if (colorSpaceOptions.some((value) => value !== colorSpaceOptions[0])) {
    throw new Error("KTX2 color-space options must not mark one texture as both linear and sRGB");
  }
  const explicitSRGB = colorSpaceOptions[0];
  if (isNormalMap && explicitSRGB === true) {
    throw new Error("KTX2 normal maps must use linear color space");
  }
  const isSRGB = options.isHDR === true || isNormalMap ? false : explicitSRGB ?? DefaultOptions.isSRGB;
  options = { ...DefaultOptions, ...options };
  // basic
  options.enableDebug !== undefined && encoder.setDebug(options.enableDebug);
  options.isUASTC !== undefined && encoder.setUASTC(options.isUASTC);
  options.isKTX2File !== undefined && encoder.setCreateKTX2File(options.isKTX2File);
  // extra
  options.generateMipmap !== undefined && encoder.setMipGen(options.generateMipmap);
  options.isYFlip !== undefined && encoder.setYFlip(options.isYFlip);
  if (isNormalMap) {
    encoder.setNormalMap();
    options.generateMipmap === true && encoder.setMipRenormalize(true);
  }
  encoder.setPerceptual(isSRGB);
  encoder.setMipSRGB(isSRGB);
  encoder.setKTX2SRGBTransferFunc(isSRGB);
  // etc1s
  options.qualityLevel !== undefined && encoder.setQualityLevel(options.qualityLevel);
  options.compressionLevel !== undefined && encoder.setCompressionLevel(options.compressionLevel);
  // uastc
  options.needSupercompression !== undefined && encoder.setKTX2UASTCSupercompression(options.needSupercompression);
  options.enableRDO && encoder.setRDOUASTC(true);
  options.rdoQualityLevel !== undefined && encoder.setRDOUASTCQualityScalar(options.rdoQualityLevel);
  options.uastcLDRQualityLevel !== undefined && encoder.setPackUASTCFlags(options.uastcLDRQualityLevel);
  // hdr, only set HDR, if hdr is true, otherwise the format mode will be etc1s
  /** see {@link https://github.com/BinomialLLC/basis_universal/blob/1172d07395a890c782c4f2ef09d2f08606c3f743/webgl/transcoder/basis_wrappers.cpp#L2307-L2321} */
  if (options.isHDR) {
    encoder.setHDR(options.isHDR);
    options.hdrQualityLevel && encoder.setUASTCHDRQualityLevel(options.hdrQualityLevel);
  }
}
