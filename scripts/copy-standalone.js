/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("fs");
const path = require("path");

const sourceDir = path.join(__dirname, "..", ".next");
const targetDir = path.join(__dirname, "..", ".next", "standalone", ".next");

function copyRecursive(src, dest) {
  if (!fs.existsSync(src)) {
    console.log(`Source does not exist: ${src}`);
    return;
  }

  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }

    const entries = fs.readdirSync(src);
    for (const entry of entries) {
      copyRecursive(path.join(src, entry), path.join(dest, entry));
    }
  } else {
    fs.copyFileSync(src, dest);
  }
}

// Copy .next/static to .next/standalone/.next/static
copyRecursive(path.join(sourceDir, "static"), path.join(targetDir, "static"));

// Copy public to .next/standalone/public
copyRecursive(path.join(__dirname, "..", "public"), path.join(__dirname, "..", ".next", "standalone", "public"));

console.log("Standalone copy complete");
