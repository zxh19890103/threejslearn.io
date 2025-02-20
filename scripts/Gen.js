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

let dirent = null;

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

    fs.writeFileSync(
      indexfile,
      `---
layout: case
title: ${dirent.name}
---

{% include_relative _explain.md %}

<h3>📝 Git logs</h3>
<div class="RuntsGitLogs">
<pre>
${readGitLogs(dirent.name)}
</pre>
</div>

`,
      { encoding: "utf8" }
    );

    writeToIndex.write(`- [${dirent.name}](/cases/${dirent.name})\n`);
    writeToMenu.write(
      `<div class="MenuItem"><a href="/cases/${dirent.name}">${dirent.name}</a></div>`
    );
  }
}

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
