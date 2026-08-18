import assert from "assert";
import { applyInputOptions } from "../../../packages/ktx2-encoder/src/applyInputOptions";
import type { IBasisEncoder } from "../../../packages/ktx2-encoder/src/type";

function createEncoderSpy() {
  const calls: Array<[string, ...unknown[]]> = [];
  const encoder = new Proxy(
    {},
    {
      get:
        (_target, property) =>
        (...args: unknown[]) =>
          calls.push([String(property), ...args])
    }
  ) as IBasisEncoder;
  return { calls, encoder };
}

describe("KTX2 input options", () => {
  it("keeps ETC1S sRGB storage and mip filtering under one color-space contract", () => {
    const { calls, encoder } = createEncoderSpy();

    applyInputOptions(
      {
        isUASTC: false,
        isSRGB: true,
        generateMipmap: true,
        compressionLevel: 3
      },
      encoder
    );

    for (const name of ["setPerceptual", "setMipSRGB", "setKTX2SRGBTransferFunc"]) {
      assert.deepStrictEqual(
        calls.filter(([calledName]) => calledName === name),
        [[name, true]]
      );
    }
    assert.deepStrictEqual(
      calls.filter(([name]) => name === "setCompressionLevel"),
      [["setCompressionLevel", 3]]
    );
  });

  it("marks data textures as linear through the same contract", () => {
    const { calls, encoder } = createEncoderSpy();

    applyInputOptions({ isSRGB: false }, encoder);

    for (const name of ["setPerceptual", "setMipSRGB", "setKTX2SRGBTransferFunc"]) {
      assert.deepStrictEqual(
        calls.filter(([calledName]) => calledName === name),
        [[name, false]]
      );
    }
  });

  it("keeps legacy color-space options compatible", () => {
    const { calls, encoder } = createEncoderSpy();

    applyInputOptions({ isPerceptual: false, isSetKTX2SRGBTransferFunc: false }, encoder);

    for (const name of ["setPerceptual", "setMipSRGB", "setKTX2SRGBTransferFunc"]) {
      assert.deepStrictEqual(
        calls.filter(([calledName]) => calledName === name),
        [[name, false]]
      );
    }
  });

  it("rejects contradictory new and legacy color-space options", () => {
    const { encoder } = createEncoderSpy();

    assert.throws(
      () => applyInputOptions({ isSRGB: true, isPerceptual: false }, encoder),
      /must not mark one texture as both linear and sRGB/
    );
  });

  it("keeps HDR textures linear", () => {
    const { calls, encoder } = createEncoderSpy();

    applyInputOptions({ isHDR: true }, encoder);

    for (const name of ["setPerceptual", "setMipSRGB", "setKTX2SRGBTransferFunc"]) {
      assert.deepStrictEqual(
        calls.filter(([calledName]) => calledName === name),
        [[name, false]]
      );
    }
  });

  it("makes normal-map encoding linear and renormalizes the source and generated mips", () => {
    const { calls, encoder } = createEncoderSpy();

    applyInputOptions({ isNormalMap: true, generateMipmap: true }, encoder);

    for (const name of ["setPerceptual", "setMipSRGB", "setKTX2SRGBTransferFunc"]) {
      assert.deepStrictEqual(
        calls.filter(([calledName]) => calledName === name),
        [[name, false]]
      );
    }
    assert.deepStrictEqual(
      calls.filter(([name]) => name === "setNormalMap"),
      [["setNormalMap"]]
    );
    assert.deepStrictEqual(
      calls.filter(([name]) => name === "setMipRenormalize"),
      [["setMipRenormalize", true]]
    );
  });

  it("rejects an sRGB normal-map contract", () => {
    const { encoder } = createEncoderSpy();

    assert.throws(
      () => applyInputOptions({ isNormalMap: true, isSRGB: true }, encoder),
      /normal maps must use linear color space/
    );
  });
});
