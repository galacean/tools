/**
 * 打包的阶段产物
 */
export interface PackingOutput {
  msg?: string;
  code?: number;
  info?: AtlasConfig;
  imageFiles?: ArrayBuffer[];
}

export class AtlasConfig {
  mipmap?: boolean;
  wrapModeV?: number;
  wrapModeU?: number;
  filterMode?: number;
  anisoLevel?: number;
  /** Version of Atlas. */
  version: number = 0;
  /** Texture format. 1 = Galacean. */
  format: number = 1;
  /** The sub atlas array, each sub atlas contains multiple sprites. */
  atlasItems: {
    /** The url of the sub atlas. */
    img: string;
    /** Image type. */
    type: string;
    /** Sprites contained in the sub atlas. */
    sprites: AtlasSprite[];
    width: number;
    height: number;
  }[] = [];
}

/**
 * The original data type of each sprite.
 */
export class AtlasSprite {
  /** Temp solution. */
  id: number;
  /** The name the sprite. */
  name: string;
  /** Whether to rotate 90 degrees clockwise. */
  atlasRotated: boolean;
  /** The range of the sprites on the big picture. */
  atlasRegion: {
    x: number;
    y: number;
    w: number;
    h: number;
  };
  /** If there is trimming, the size of the blank area on the four sides. */
  atlasRegionOffset: {
    x: number;
    y: number;
    z: number;
    w: number;
  };
  region: {
    x: number;
    y: number;
    w: number;
    h: number;
  };
  pivot: {
    x: number;
    y: number;
  };
  border: {
    x: number;
    y: number;
    z: number;
    w: number;
  };
  pixelsPerUnit: number;
  width: number;
  height: number;
}
