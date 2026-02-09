import esbuild, { Plugin } from "esbuild";
import fg from "fast-glob";
import fs from "node:fs";
import path from "node:path";

// Plugin to inline regular CSS into JS
const inlineCSSPlugin: Plugin = {
  name: "inline-css",
  setup(build) {
    build.onLoad({ filter: /\.css$/ }, async (args) => {
      const css = await fs.promises.readFile(args.path, "utf8");

      // Return JS that injects a style tag with the CSS
      const contents = `
        if (typeof document !== 'undefined') {
          const style = document.createElement('style');
          style.textContent = ${JSON.stringify(css)};
          document.head.appendChild(style);
        }
      `;

      return { contents, loader: "js" };
    });
  },
};

const entries = fg.sync("src/**/index.{tsx,jsx}");
const outDir = "../../backend/static/components";
const __dirname = path
  .dirname(new URL(import.meta.url).pathname)
  .replace(/^\/([A-Z]:)/, "$1"); // Fix Windows drive letter

const targets: string[] = ["product-card", "sources-card"];
const builtNames: string[] = [];

fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

for (const file of entries) {
  const name = path.basename(path.dirname(file));
  if (targets.length && !targets.includes(name)) {
    continue;
  }

  const entryAbs = path.resolve(file);

  console.group(`Building ${name} (esbuild with inline CSS)`);

  await esbuild.build({
    entryPoints: [entryAbs],
    bundle: true,
    format: "esm",
    target: "es2022",
    minify: true,
    treeShaking: true,
    jsx: "automatic",
    jsxImportSource: "react",
    outfile: path.join(outDir, `${name}.bundle.js`),
    plugins: [inlineCSSPlugin],
  });

  console.groupEnd();
  builtNames.push(name);
  console.log(`Built ${name}`);
}

console.log(`\nSuccessfully built: ${builtNames.join(", ")}`);
