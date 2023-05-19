#!/usr/bin/env node

const program = require("commander");
const fs = require("fs");
const path = require("path");
const transform = require("../dist/main");
const packageJson = JSON.parse(
  fs.readFileSync(path.join(__dirname, "../package.json"))
);
program.version(packageJson.version);

// Pack images to atlas.
program
  .option("-s, --src <src>", "the lottie JSON file")
  .option("-i, --images <images>", "the image files")
  .option("-mw, --maxWidth <maxWidth>", "the max width limit, default 1024")
  .option("-mh, --maxHeight <maxHeight>", "the max height limit, default 1024")
  .description("Transform lottie file to galacean atlas format")
  .action((argv) => {
    transform(argv.src, argv.images, { maxWidth: argv.maxWidth || 1024, maxHeight: argv.maxHeight || 1024 });
  });

program.parse(process.argv);