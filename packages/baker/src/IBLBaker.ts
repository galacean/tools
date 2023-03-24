import {
  Camera,
  Material,
  Matrix,
  MeshRenderer,
  PrimitiveMesh,
  RenderTarget,
  Scene,
  Shader,
  TextureCube,
  TextureCubeFace,
  TextureFilterMode,
  TextureFormat,
  Vector3
} from "oasis-engine";
import { BakerResolution } from "./enums/BakerResolution";
import frag from "./shader/ibl_frag";
import vertex from "./shader/vertex";

const SHADER_NAME = "Oasis-IBL-baker";
Shader.create(SHADER_NAME, vertex, frag);

/**
 * Prefilterd, Mipmaped Environment map.
 */
export class IBLBaker {
  private static _position: Vector3 = new Vector3(0, 0, 0);
  private static _cacheDir: Vector3 = new Vector3();
  private static _cacheUp: Vector3 = new Vector3();

  /**
   * Bake from Scene.
   * @param scene - Scene wanna bake
   */
  static fromScene(scene: Scene, resolution: BakerResolution): TextureCube {
    const engine = scene.engine;
    const isPaused = engine.isPaused;
    const originalRoots = scene.rootEntities.slice();
    engine.pause();

    // render scene to RTT
    for (let i = 0; i < originalRoots.length; i++) {
      const root = originalRoots[i];
      scene.removeRootEntity(root);
    }

    const bakerRoot = scene.createRootEntity("bake");
    const bakerCamera = bakerRoot.addComponent(Camera);
    bakerCamera.enableFrustumCulling = false;
    bakerCamera.fieldOfView = 90;
    bakerCamera.aspectRatio = 1;

    const RTTScene = new TextureCube(engine, resolution, TextureFormat.R32G32B32A32); // baker platform must support float texture.
    const RTScene = new RenderTarget(engine, resolution, resolution, RTTScene);
    RTScene.autoGenerateMipmaps = true;
    bakerCamera.renderTarget = RTScene;

    for (let face = 0; face < 6; face++) {
      IBLBaker._setCamera(TextureCubeFace.PositiveX + face, bakerCamera);
      bakerCamera.render(TextureCubeFace.PositiveX + face);
    }

    // Bake RTT
    const bakerMaterial = new Material(engine, Shader.find(SHADER_NAME));
    const entity = bakerRoot.createChild();
    const bakerRenderer = entity.addComponent(MeshRenderer);
    const bakerShaderData = bakerMaterial.shaderData;
    bakerRenderer.mesh = PrimitiveMesh.createPlane(engine, 2, 2);
    bakerRenderer.setMaterial(bakerMaterial);

    const RTTBake = new TextureCube(engine, resolution);
    RTTBake.filterMode = TextureFilterMode.Trilinear;
    const RTBake = new RenderTarget(engine, resolution, resolution, RTTBake);
    RTBake.autoGenerateMipmaps = false;
    bakerCamera.renderTarget = RTBake;

    const bakerMipmapCount = RTTBake.mipmapCount;

    bakerShaderData.setTexture("environmentMap", RTTScene);
    bakerShaderData.setFloat("u_textureSize", resolution);

    for (let face = 0; face < 6; face++) {
      for (let lod = 0; lod < bakerMipmapCount; lod++) {
        bakerShaderData.setFloat("face", face);
        const lodRoughness = lod / (bakerMipmapCount - 1); // linear
        bakerShaderData.setFloat("lodRoughness", lodRoughness);
        bakerCamera.render(TextureCubeFace.PositiveX + face, lod);
      }
    }

    // revert
    bakerRoot.destroy();
    RTScene.destroy();
    RTBake.destroy();
    !isPaused && engine.resume();

    for (let i = 0; i < originalRoots.length; i++) {
      const root = originalRoots[i];
      scene.addRootEntity(root);
    }

    return RTTBake;
  }

  private static _setCamera(faceIndex: TextureCubeFace, camera: Camera) {
    const position = IBLBaker._position;
    const cacheUp = IBLBaker._cacheUp;
    const cacheDir = IBLBaker._cacheDir;

    switch (faceIndex) {
      case TextureCubeFace.PositiveX:
        cacheUp.set(0, -1, 0);
        cacheDir.set(1, 0, 0);
        break;
      case TextureCubeFace.NegativeX:
        cacheUp.set(0, -1, 0);
        cacheDir.set(-1, 0, 0);
        break;
      case TextureCubeFace.PositiveY:
        cacheUp.set(0, 0, 1);
        cacheDir.set(0, 1, 0);
        break;
      case TextureCubeFace.NegativeY:
        cacheUp.set(0, 0, -1);
        cacheDir.set(0, -1, 0);
        break;
      case TextureCubeFace.PositiveZ:
        cacheUp.set(0, -1, 0);
        cacheDir.set(0, 0, 1);
        break;
      case TextureCubeFace.NegativeZ:
        cacheUp.set(0, -1, 0);
        cacheDir.set(0, 0, -1);
        break;
    }

    Vector3.add(position, cacheDir, cacheDir);
    Matrix.lookAt(position, cacheDir, cacheUp, camera.viewMatrix);
  }
}
