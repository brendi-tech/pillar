import react from "@vitejs/plugin-react";
import fg from "fast-glob";
import fs from "node:fs";
import path from "node:path";
import { build, PluginOption, type InlineConfig } from "vite";

const entries = fg.sync("src/**/index.{tsx,jsx}");
const outDir = "../../backend/static/components";
const __dirname = path
  .dirname(new URL(import.meta.url).pathname)
  .replace(/^\/([A-Z]:)/, "$1"); // Fix Windows drive letter

const targets: string[] = ["product-card", "sources-card"];
const builtNames: string[] = [];

fs.rmSync(outDir, { recursive: true, force: true });

for (const file of entries) {
  const name = path.basename(path.dirname(file));
  if (targets.length && !targets.includes(name)) {
    continue;
  }

  const entryAbs = path.resolve(file);

  const createConfig = (): InlineConfig => ({
    plugins: [
      react() as PluginOption,
      {
        name: "remove-manual-chunks",
        outputOptions(options) {
          if ("manualChunks" in options) {
            delete (options as any).manualChunks;
          }
          return options;
        },
      },
    ],
    css: {
      postcss: path.resolve(__dirname, "postcss.config.js"),
    },
    esbuild: {
      jsx: "automatic",
      jsxImportSource: "react",
      target: "es2022",
    },
    build: {
      target: "es2022",
      outDir,
      emptyOutDir: false,
      chunkSizeWarningLimit: 2000,
      minify: "esbuild",
      cssCodeSplit: false,
      rollupOptions: {
        input: entryAbs,
        output: {
          format: "es",
          entryFileNames: `${name}.bundle.js`,
          inlineDynamicImports: true,
          assetFileNames: (info) =>
            (info.name || "").endsWith(".css")
              ? `${name}.css`
              : `[name]-[hash][extname]`,
        },
        preserveEntrySignatures: "allow-extension",
        treeshake: true,
      },
    },
  });

  console.group(`Building ${name} (react)`);
  await build(createConfig());
  console.groupEnd();
  builtNames.push(name);
  console.log(`Built ${name}`);
}

// const outputs = fs
//   .readdirSync("assets")
//   .filter((f) => f.endsWith(".js") || f.endsWith(".css"))
//   .map((f) => path.join("assets", f))
//   .filter((p) => fs.existsSync(p));

// const h = crypto
//   .createHash("sha256")
//   .update(pkg.version, "utf8")
//   .digest("hex")
//   .slice(0, 4);

// console.group("Hashing outputs");
// for (const out of outputs) {
//   const dir = path.dirname(out);
//   const ext = path.extname(out);
//   const base = path.basename(out, ext);
//   const newName = path.join(dir, `${base}-${h}${ext}`);

//   fs.renameSync(out, newName);
//   console.log(`${out} -> ${newName}`);
// }
// console.groupEnd();

// console.log("new hash: ", h);

// const defaultBaseUrl = "http://localhost:4444";
// const baseUrlCandidate = process.env.BASE_URL?.trim() ?? "";
// const baseUrlRaw = baseUrlCandidate.length > 0 ? baseUrlCandidate : defaultBaseUrl;
// const normalizedBaseUrl = baseUrlRaw.replace(/\/+$/, "") || defaultBaseUrl;
// console.log(`Using BASE_URL ${normalizedBaseUrl} for generated HTML`);

// for (const name of builtNames) {
//   const dir = outDir;
//   const hashedHtmlPath = path.join(dir, `${name}-${h}.html`);
//   const liveHtmlPath = path.join(dir, `${name}.html`);
//   const html = `<!doctype html>
// <html>
// <head>
//   <script type="module" src="${normalizedBaseUrl}/${name}-${h}.js"></script>
//   <link rel="stylesheet" href="${normalizedBaseUrl}/${name}-${h}.css">
// </head>
// <body>
//   <div id="${name.toLowerCase()}-root"></div>
// </body>
// </html>
// `;
//   fs.writeFileSync(hashedHtmlPath, html, { encoding: "utf8" });
//   fs.writeFileSync(liveHtmlPath, html, { encoding: "utf8" });
//   console.log(`${liveHtmlPath}`);
// }
