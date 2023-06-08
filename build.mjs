import esbuild from 'esbuild';

let context = await esbuild.context( {
    entryPoints: ["scripts/minesweeper.ts", "scripts/pong.ts", "scripts/pongMultiplayer.ts"],
    outdir: "js",
    bundle: true,
    // minify: true
});

await context.watch()