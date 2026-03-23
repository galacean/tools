import { Rect } from "@galacean/tools-atlas-algorithm";
import { PackingOption } from "../interface/PackingOption";
import { PackingItem } from "./PackingItem";
import { PackingOutput } from "./PackingOutput";

export interface PackingBin {
  rects: Rect[];
  width: number;
  height: number;
}

export interface PackingContext {
  images: PackingItem[];
  option: PackingOption;
  outPut: PackingOutput;
  bins?: PackingBin[];
}
