const esbuild = require("esbuild");

const isWatch = process.argv.includes("--watch");

const config = {
    entryPoints: ["src/main.js"],
    bundle: true,
    outfile: "dist/content.js",
    format: "iife",
    target: "chrome100",
    minify: !isWatch,
    sourcemap: isWatch ? "inline" : false,
};

if (isWatch) {
    esbuild.context(config).then((ctx) => {
        ctx.watch();
        console.log("Watching for changes...");
    });
} else {
    esbuild.build(config).then(() => {
        console.log("Build complete: dist/content.js");
    });
}
