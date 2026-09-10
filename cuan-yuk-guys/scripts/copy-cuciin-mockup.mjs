import { cpSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const src = join(repoRoot, "laundry-ops", "mockup");
const dest = join(repoRoot, "cuan-yuk-guys", "public", "cuciin");

if (!existsSync(join(src, "index.html"))) {
  console.warn("copy-cuciin-mockup: laundry-ops/mockup tidak ada, skip");
  process.exit(0);
}

mkdirSync(dest, { recursive: true });
for (const file of ["index.html", "styles.css", "app.js"]) {
  cpSync(join(src, file), join(dest, file));
}
console.log("copy-cuciin-mockup: public/cuciin siap");
