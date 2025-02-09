#!/usr/bin/env node

const fs = require("fs");
const { join } = require("path");

const name = process.argv[2];
const folder = join(__dirname, "../cases", name);

if (fs.existsSync(folder)) {
  throw new Error(`folder ${name} exists!`);
}

fs.mkdirSync(folder);

const runTsContent = `
/**
* Generated Automatically At ${new Date()};
*/

import * as THREE from "three";

//#region reactive
// __dev__();
// __defineControl__("[key]", "[type]", [val]);

__updateControlsDOM__ = () => {
  __renderControls__({
  // key: val
  });
};

__onControlsDOMChanged__iter__ = (exp) => {
  eval(exp);
};
//#endregion

__main__ = (s: THREE.Scene, c: THREE.Camera, r: THREE.WebGLRenderer) => {
  // your code

  __updateTHREEJs__ = (k: string, val: any) => {
    // variables changed, run your code!
  };
};

`;

fs.writeFileSync(join(folder, "run.ts"), runTsContent, { encoding: "utf8" });
fs.writeFileSync(
  join(folder, "_explain.md"),
  `<!--
  Generated Automatically At ${new Date()};
  Here You Explain What You want to Explain.
-->\n\n`,
  { encoding: "utf8" }
);
fs.writeFileSync(
  join(folder, "index.md"),
  `---
layout: playground
title: Materials-LineBasicMaterial
---

{% include_relative _explain.md %}
`,
  { encoding: "utf8" }
);
