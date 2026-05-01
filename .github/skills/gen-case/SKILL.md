---
name: gen-case
description: Create a folder for the case under the folder of `cases/`
argument-hint: a folder under `cases/` created with the name devs typed, and including several files to be used as a case for devs.
---

Fisrtly say Hello to users with a smile.

And then just create folder the user typed.

You can only create this folder under `cases/` and the name of the folder should be the same as the name user typed.

in the folder, it includes three files:

- `index.html` with content:

```md
---
layout: case
title: { { Name of the Case } }
---

{% include_relative _explain.md %}
```

- `run.ts` with code:

```ts
/**
 * Generated Automatically At {{The Time When the Case is Created}};
 */
import * as THREE from "three";

let enableGrid = false;
let enableAxes = false;

//#region reactive
__dev__();
__defineControl__("enableGrid", "bit", enableGrid);
__defineControl__("enableAxes", "bit", enableAxes);

__updateControlsDOM__ = () => {
  __renderControls__({
    enableAxes,
    enableGrid,
  });
};

__onControlsDOMChanged__iter__ = (exp) => eval(exp);
//#endregion

__main__ = (
  world: THREE.Scene,
  camera: THREE.PerspectiveCamera,
  renderer: THREE.WebGLRenderer,
) => {
  // your code

  __updateTHREEJs__only__.enableGrid = (val) => __3__.grid(val);
  __updateTHREEJs__only__.enableAxes = (val) => __3__.axes(val);

  __updateTHREEJs__ = (k: string, val: any) => {
    // variables changed, run your code!
  };
};
```

- `_explain.md` with content:

```md
<!--
  Generated Automatically At {{The Time When the Case is Created}};
  Here You Explain What You want to Explain.
-->\n\n
```
