import resolve from "@rollup/plugin-node-resolve";
import glslify from "rollup-plugin-glslify";
import { binary2base64 } from "rollup-plugin-binary2base64";
import { swc, defineRollupSwcOption, minify } from "rollup-plugin-swc3";
import camelCase from "camelcase";
import fs from "fs";
import path from "path";
import replace from "@rollup/plugin-replace";

function walk(dir) {
  let files = fs.readdirSync(dir);
  files = files.map((file) => {
    const filePath = path.join(dir, file);
    const stats = fs.statSync(filePath);
    if (stats.isDirectory()) return walk(filePath);
    else if (stats.isFile()) return filePath;
  });
  return files.reduce((all, folderContents) => all.concat(folderContents), []);
}

const pkgsRoot = path.join(process.cwd(), "packages");
const pkgs = fs
  .readdirSync(pkgsRoot)
  .map((dir) => path.join(pkgsRoot, dir))
  .filter((dir) => fs.statSync(dir).isDirectory())
  .map((location) => {
    return {
      location: location,
      pkgJson: JSON.parse(fs.readFileSync(path.resolve(location, "package.json"), { encoding: "utf-8" }))
    };
  });

// "@galacean/toolsBaker" ...
function toGlobalName(pkgName) {
  return camelCase(pkgName);
}

const extensions = [".js", ".jsx", ".ts", ".tsx"];

const plugins = [
  resolve({ extensions, preferBuiltins: true }),
  glslify({
    include: [/\.glsl$/]
  }),
  swc(
    defineRollupSwcOption({
      include: /\.[mc]?[jt]sx?$/,
      exclude: /node_modules/,
      jsc: {
        loose: true,
        externalHelpers: true,
        target: "es5"
      },
      sourceMaps: true
    })
  ),
  binary2base64({
    include: ["**/*.wasm"]
  })
];

function makeRollupConfig(pkg) {
  const externals = Object.keys(
    Object.assign({}, pkg.pkgJson.dependencies, pkg.pkgJson.peerDependencies, pkg.pkgJson.devDependencies)
  );

  const entries = Object.fromEntries(
    walk(path.join(pkg.location, "src"))
      .filter((file) => /^(?!.*\.d\.ts$).*\.(ts|js)$/.test(file))
      .map((item) => {
        return [path.relative(path.join(pkg.location, "src"), item.replace(/\.[^/.]+$/, "")), item];
      })
  );

  plugins.push(
    replace({
      preventAssignment: true,
      __buildVersion: pkg.pkgJson.version
    })
  );

  const globals = {};
  externals.forEach((external) => {
    globals[external] = toGlobalName(external);
  });

  globals["@galacean/engine"] = "Galacean";

  // Use publishConfig paths for build output to avoid overwriting source files.
  // During development, main/module/browser point to src/index.ts for direct consumption;
  // publishConfig contains the actual dist output paths used for npm publishing.
  const publish = pkg.pkgJson.publishConfig || {};
  const mainOutput = publish.main || pkg.pkgJson.main;
  const moduleOutput = publish.module || pkg.pkgJson.module;
  const browserOutput = publish.browser || pkg.pkgJson.browser;

  const config = [];
  const input = path.join(pkg.location, "src", pkg.pkgJson.types ? "index.ts" : "index.js");
  if (mainOutput) {
    config.push({
      input,
      output: {
        file: path.join(pkg.location, mainOutput),
        format: "commonjs",
        sourcemap: true
      },
      external: externals,
      plugins
    });
  }
  if (moduleOutput) {
    config.push({
      input,
      output: {
        file: path.join(pkg.location, moduleOutput),
        format: "es",
        sourcemap: true
      },
      external: externals,
      plugins
    });
  }
  if (browserOutput) {
    config.push({
      input,
      output: {
        file: path.join(pkg.location, browserOutput),
        format: "umd",
        name: toGlobalName(pkg.pkgJson.name),
        globals: globals
      },
      // 总包只 external @galacean/engine
      external: pkg.pkgJson.name === "@galacean/tools" ? ["@galacean/engine"] : externals,
      plugins: [...plugins, minify({ sourceMap: true })]
    });
  }

  return config;
}

export default Promise.all(pkgs.map(makeRollupConfig).flat());
