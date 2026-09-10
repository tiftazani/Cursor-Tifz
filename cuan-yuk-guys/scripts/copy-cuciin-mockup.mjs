import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
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
cpSync(join(src, "styles.css"), join(dest, "styles.css"));
cpSync(join(src, "app.js"), join(dest, "app.js"));

let html = readFileSync(join(src, "index.html"), "utf8");
if (!html.includes("<base ")) {
  html = html.replace("<head>", '<head>\n  <base href="/cuciin/" />');
}
html = html.replace('href="styles.css"', 'href="/cuciin/styles.css"');
html = html.replace('src="app.js"', 'src="/cuciin/app.js"');
writeFileSync(join(dest, "index.html"), html);

console.log("copy-cuciin-mockup: public/cuciin siap");
