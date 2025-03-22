import fs from "fs";
import { join } from "path";
import { execSync } from "child_process";
import { __dirname } from "./env.js";

const cases = fs.opendirSync(join(__dirname, "../cases"), {});

let sortedDirs = [];
let sorted = false;
let readCursor = -1;

function readDir() {
  if (!sorted) {
    let dirent = null;
    while ((dirent = cases.readSync())) {
      if (dirent.isDirectory()) {
        sortedDirs.push(dirent);
      }
    }

    sortedDirs.sort((a, b) =>
      String.prototype.localeCompare.call(a.name, b.name)
    );

    sorted = true;
  }

  return sortedDirs[++readCursor];
}

/**@type {fs.Dirent} */
let dirent = null;
/**@type {string} */
let currentCat = null;

const writeToIndex = fs.createWriteStream(join(__dirname, "../cases.md"), {
  encoding: "utf8",
});

const writeToMenu = fs.createWriteStream(
  join(__dirname, "../_includes/menu.html"),
  {
    encoding: "utf8",
  }
);

writeToIndex.write(`---
layout: default
title: Cases
---


`);

writeToMenu.write('<div class="MenuItems">');

while ((dirent = readDir())) {
  if (dirent.isDirectory()) {
    const indexfile = join(cases.path, dirent.name, "index.md");

    const directoryName = dirent.name;

    fs.writeFileSync(
      indexfile,
      `---
layout: case
title: ${directoryName}
---

{% include_relative _explain.md %}

<h3>📃 Source Code</h3>
<div>
<a href="https://github.com/zxh19890103/threejslearn.io/tree/main/cases/${
        dirent.name
      }" target="_blank">Go!</a>
</div>

<h3>📝 Git logs</h3>
<div class="RuntsGitLogs">
<pre>
${readGitLogs(directoryName)}
</pre>
</div>

`,
      { encoding: "utf8" }
    );

    const parts = directoryName.split("-");

    if (currentCat !== parts[0]) {
      if (currentCat !== null) {
        writeToMenu.write("</div>");
      }
      writeToMenu.write('<div class="Cat MenuItemsGroup">');
    }

    currentCat = parts[0];

    writeToIndex.write(`- [${directoryName}](/cases/${directoryName})\n`);

    writeToMenu.write(
      `
<div class="MenuItem">
  <a href="/cases/${directoryName}">${directoryName}</a>
</div>
      `
    );
  }
}

writeToMenu.write("</div>");

sortedDirs = [];
readCursor = -1;
sorted = false;

writeToMenu.write("</div>");
writeToMenu.end();
writeToIndex.end();
cases.close();

function readGitLogs(_case) {
  const path = join(__dirname, "../cases/", _case, "run.ts");

  // 执行 Git 命令
  const output = execSync(`git log ${path}`, { encoding: "utf8" });

  return output;
}
