const fs = require("fs");
const { join } = require("path");

const cases = fs.opendirSync(join(__dirname, "../cases"), {});
cases.readSync().isDirectory;

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
