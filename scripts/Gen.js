const fs = require("fs");
const { join } = require("path");

const cases = fs.opendirSync(join(__dirname, "../cases"), {});

let dirent = null;

const writeToIndex = fs.createWriteStream(join(__dirname, "../playground.md"), {
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
title: PlayGround
---


`);

writeToMenu.write('<div class="MenuItems">');

while ((dirent = cases.readSync())) {
  if (dirent.isDirectory()) {
    const indexfile = join(cases.path, dirent.name, "index.md");

    fs.writeFileSync(
      indexfile,
      `---
layout: playground
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

writeToMenu.write("</div>");
writeToMenu.end();
writeToIndex.end();
cases.close();
