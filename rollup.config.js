"use strict";

const clear = require('rollup-plugin-clear');
const { nodeResolve } = require('@rollup/plugin-node-resolve'); // Corrected import
const commonjs = require('@rollup/plugin-commonjs');
const typescript = require('rollup-plugin-typescript2');
const inject = require('@rollup/plugin-inject');
const path = require('path');


let cfg;
const dest = process.env.DEST;
const outputFile = "dist/main.js";
if (!dest) {
  console.log("No destination specified - code will be compiled but not uploaded");
} else if ((cfg = require("./screeps.json")[dest]) == null) {
  throw new Error("Invalid upload destination");
}

export default {
  input: "src/main.ts",
  output: {
    file: outputFile,
    format: "cjs",
    sourcemap: true
  },

  plugins: [
    clear({ targets: ["dist"] }),
    nodeResolve({ browser: true, preferBuiltins: false }),
    commonjs(),
    typescript({tsconfig: "./tsconfig.json", clean: true}),
    inject({
      Promise: path.resolve('src/polyfills/promisepolyfill/index.js'),
      setInterval: path.resolve('src/polyfills/setintervalpolyfill/index.js'),
      setTimeout: path.resolve('src/polyfills/settimeoutpolyfill/index.js'),
      clearInterval: path.resolve('src/polyfills/clearintervalpolyfill/index.js'),
      clearTimeout: path.resolve('src/polyfills/cleartimeoutpolyfill/index.js')
    })
  ]
}
