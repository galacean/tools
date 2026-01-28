import { MaxRectsPacker } from "maxrects-packer";
import { PackingOption } from "../interface/PackingOption";
import { PackingItem } from "./PackingItem";
import { PackingOutput } from "./PackingOutput";

export interface PackingContext {
  images: PackingItem[];
  option: PackingOption;
  outPut: PackingOutput;
  packer?: MaxRectsPacker;
}
