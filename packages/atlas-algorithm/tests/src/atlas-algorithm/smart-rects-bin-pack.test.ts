import fs from "fs";
import path from "path";
import assert from "assert";
import { Rect } from "../../../src/Rect";
import { SmartRectsBinPack } from "../../../src/MaxRects/SmartRectsBinPack";
import { MaxRectsMethod } from "../../../src/MaxRects/enums/MaxRectsMethod";

interface ScenarioRect {
  width: number;
  height: number;
  data?: string;
}

interface PackBin {
  packer: SmartRectsBinPack;
  rects: Array<Rect>;
  width: number;
  height: number;
}

function loadScenarios(): Array<Array<ScenarioRect>> {
  const filePath = path.join(__dirname, "../../fixtures/scenarios.json");
  const raw = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(raw) as Array<Array<ScenarioRect>>;
}

function buildRects(scenario: Array<ScenarioRect>): Array<Rect> {
  return scenario.map((item, index) => {
    const name = item.data ?? `rect-${index}`;
    return new Rect(0, 0, item.width, item.height, name);
  });
}

function getBinSize(scenario: Array<ScenarioRect>) {
  let maxWidth = 0;
  let maxHeight = 0;
  for (let i = 0; i < scenario.length; i++) {
    maxWidth = Math.max(maxWidth, scenario[i].width);
    maxHeight = Math.max(maxHeight, scenario[i].height);
  }
  return { maxWidth, maxHeight };
}

function packScenario(
  scenario: Array<ScenarioRect>,
  method: MaxRectsMethod,
  allowRotate: boolean
) {
  const { maxWidth, maxHeight } = getBinSize(scenario);
  const remaining = buildRects(scenario);
  const bins: Array<PackBin> = [];

  while (remaining.length > 0) {
    const packer = new SmartRectsBinPack();
    packer.init(maxWidth, maxHeight, allowRotate);
    const packed = packer.insert2(remaining, method);
    if (packed.length === 0) break;
    bins.push({ packer, rects: packed, width: maxWidth, height: maxHeight });
  }

  return { bins, remaining, maxWidth, maxHeight };
}

function assertRectsInBounds(rects: Array<Rect>, width: number, height: number) {
  rects.forEach((rect) => {
    const rectWidth = rect.isRotated ? rect.height : rect.width;
    const rectHeight = rect.isRotated ? rect.width : rect.height;
    assert.ok(rect.x >= 0, "rect.x >= 0");
    assert.ok(rect.y >= 0, "rect.y >= 0");
    assert.ok(
      rect.x + rectWidth <= width,
      "rect.x + rect.width <= width"
    );
    assert.ok(
      rect.y + rectHeight <= height,
      "rect.y + rect.height <= height"
    );
  });
}

function assertNoOverlap(rects: Array<Rect>) {
  for (let i = 0; i < rects.length; i++) {
    const a = rects[i];
    const aWidth = a.isRotated ? a.height : a.width;
    const aHeight = a.isRotated ? a.width : a.height;
    for (let j = i + 1; j < rects.length; j++) {
      const b = rects[j];
      const bWidth = b.isRotated ? b.height : b.width;
      const bHeight = b.isRotated ? b.width : b.height;
      const overlap = !(
        a.x + aWidth <= b.x ||
        b.x + bWidth <= a.x ||
        a.y + aHeight <= b.y ||
        b.y + bHeight <= a.y
      );
      assert.strictEqual(overlap, false, `overlap: ${a.name} & ${b.name}`);
    }
  }
}

function sumArea(rects: Array<ScenarioRect>) {
  return rects.reduce((acc, item) => acc + item.width * item.height, 0);
}

export function runScenarioTests(
  method: MaxRectsMethod,
  allowRotate: boolean
) {
  const scenarios = loadScenarios();
  const summary: Array<{
    scenario: number;
    rects: number;
    bins: number;
    occupancy: number;
  }> = [];

  scenarios.forEach((scenario, index) => {
    const { bins, remaining, maxWidth, maxHeight } = packScenario(
      scenario,
      method,
      allowRotate
    );

    assert.strictEqual(
      remaining.length,
      0,
      `scenario ${index} should pack all rects`
    );

    bins.forEach((bin) => {
      assertRectsInBounds(bin.rects, bin.width, bin.height);
      assertNoOverlap(bin.rects);
    });

    const totalArea = sumArea(scenario);
    const binArea = maxWidth * maxHeight * Math.max(1, bins.length);
    summary.push({
      scenario: index,
      rects: scenario.length,
      bins: bins.length,
      occupancy: Math.round((totalArea / binArea) * 10000) / 10000
    });
  });

  console.log(
    `SmartRectsBinPack: method=${MaxRectsMethod[method]}, allowRotate=${allowRotate}`
  );
  console.table(
    summary.map((row) => ({
      scenario: row.scenario,
      rects: row.rects,
      bins: row.bins,
      occupancy: row.occupancy
    }))
  );
}

export function runSmartRectsBinPackTests() {
  runScenarioTests(MaxRectsMethod.BestLongSideFit, false);
  runScenarioTests(MaxRectsMethod.BestAreaFit, true);
}
