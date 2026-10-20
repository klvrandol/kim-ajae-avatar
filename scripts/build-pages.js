// Produce a self-contained GitHub Pages site; keep the original Node server intact.
import { mkdir, copyFile, readFile, writeFile, cp } from "node:fs/promises";
const root = new URL("../", import.meta.url);
await mkdir(new URL("docs/", root), { recursive: true });
for (const file of ["app.js", "avatar.js", "audio.js", "style.css"])
  await copyFile(
    new URL("public/" + file, root),
    new URL("docs/" + file, root),
  );
await cp(new URL("public/assets/", root), new URL("docs/assets/", root), {
  recursive: true,
});
const html = (
  await readFile(new URL("public/index.html", root), "utf8")
).replace(
  '<script type="module"',
  '<script>window.KIM_AJAE_STATIC=true;</script><script type="module"',
);
await writeFile(new URL("docs/index.html", root), html);
await writeFile(new URL("docs/.nojekyll", root), "");
console.log("Static Pages site generated in docs/");
