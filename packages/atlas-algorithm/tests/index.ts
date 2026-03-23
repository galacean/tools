import { runSmartRectsBinPackTests } from "./src/atlas-algorithm/smart-rects-bin-pack.test";

function main() {
  runSmartRectsBinPackTests();
}

try {
  main();
} catch (error) {
  console.error(error);
  process.exit(1);
}
