#!/usr/bin/env node

const program = require("commander");
const fs = require("fs");
const path = require("path");
const transform = require("../index");
const packageJson = JSON.parse(
  fs.readFileSync(path.join(__dirname, "../package.json"))
);
program.version(packageJson.version);

// Pack images to atlas.
program
  .option("-s, --src <src>", "the lottie JSON file")
  .option("-i, --images <images>", "the image files")
  .description("Transform lottie file to oasis atlas format")
  .action((argv) => {
    transform(argv.src, argv.images);
  });

program.parse(process.argv);