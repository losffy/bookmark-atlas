import esbuild from "esbuild";
import process from "node:process";

const prod = process.argv.includes("production");

const context = await esbuild.context({
  banner: {
    js: "/* eslint-disable */"
  },
  bundle: true,
  entryPoints: ["src/main.ts"],
  external: ["obsidian", "electron", "@codemirror/autocomplete", "@codemirror/collab", "@codemirror/commands", "@codemirror/language", "@codemirror/lint", "@codemirror/search", "@codemirror/state", "@codemirror/view", "@lezer/common", "@lezer/highlight", "@lezer/lr"],
  format: "cjs",
  logLevel: "info",
  outfile: "main.js",
  platform: "browser",
  sourcemap: prod ? false : "inline",
  target: "es2020",
  treeShaking: true
});

if (prod) {
  await context.rebuild();
  await context.dispose();
} else {
  await context.watch();
}
