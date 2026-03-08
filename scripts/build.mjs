import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { build, transform } from "esbuild";

const root = resolve(process.cwd());
const srcTemplate = resolve(root, "src/app/template.html");
const srcCss = resolve(root, "src/app/styles.css");
const srcEntry = resolve(root, "src/app/main.ts");
const distDir = resolve(root, "dist");
const distHtml = resolve(distDir, "index.html");
const dist404 = resolve(distDir, "404.html");
const distNoJekyll = resolve(distDir, ".nojekyll");
const rootHtml = resolve(root, "index.html");

await mkdir(distDir, { recursive: true });

const [templateHtml, cssRaw] = await Promise.all([
  readFile(srcTemplate, "utf8"),
  readFile(srcCss, "utf8")
]);

const jsBundle = await build({
  entryPoints: [srcEntry],
  bundle: true,
  write: false,
  format: "iife",
  target: ["es2020"],
  minify: true,
  platform: "browser"
});

const jsCode = jsBundle.outputFiles[0].text;
const cssMin = await transform(cssRaw, { loader: "css", minify: true });

const html = templateHtml
  .replace("__APP_CSS__", cssMin.code)
  .replace("__APP_JS__", jsCode);

await Promise.all([
  writeFile(distHtml, html, "utf8"),
  writeFile(dist404, html, "utf8"),
  writeFile(distNoJekyll, "", "utf8"),
  writeFile(rootHtml, html, "utf8")
]);

console.log("Built dist/index.html, dist/404.html, dist/.nojekyll, and index.html");
