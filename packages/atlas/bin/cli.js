#!/usr/bin/env node

const program = require("commander");
const fs = require("fs");
const path = require("path");
const core = require("../dist/es");

const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, "../package.json")));
program.version(packageJson.version);

// Convert other atlas formats to oasis atlas.
program
  .command("formatConversion <filePath>")
  .description("convert other atlas formats to oasis atlas")
  .alias("fc")
  .option("-t, --type []", "atlas format", "texture-packer")
  .option("-o, --output [atlas fileName]", "the name of output", "oasis-atlas")
  .action((filePath, cmdObj) => {
    core.formatConversion(filePath, cmdObj);
  });

// Pack images to atlas.
program
  .command("pack <imageDir|imageName> [other...]")
  .description("pack images to atlas")
  .alias("p")
  .option("-f, --format []", "the format for atlas", "oasis")
  .option("-o, --output <fileName>", "output atlas filename", "oasis")
  .option("-a, --algorithm []", "the algorithm for pack", "maxrects")
  .option("-ar, --allowRotate []", "mark whether image allow rotate when pack", false)
  .option("-p, --padding []", "between images", 1)
  .option("-mw, --maxWidth []", "the texture max width", 1024)
  .option("-mh, --maxHeight []", "the texture max height", 1024)
  .option("-s, --square []", "the texture size forced square", false)
  .option("-pot, --pot []", "the texture size forced power of 2", false)
  .action(async (srcDir, other, cmdObj) => {
    other.push(srcDir);
    cmdObj.padding = Math.floor(cmdObj.padding);
    cmdObj.maxWidth = Math.floor(cmdObj.maxWidth);
    cmdObj.maxHeight = Math.floor(cmdObj.maxHeight);
    const ret = await core.pack(other, cmdObj);
    console.log(ret);

    if (ret.code === 0) {
      const info = ret.info;
      console.log(`Atlas pack done! \nthe atlas file is ${info.atlasFile}\nthe image file is ${info.imageFile}`);
    } else {
      console.log(`Atlas pack failed, the error is: ${ret.msg}`);
    }
  });

program.parse(process.argv);
