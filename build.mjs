import esbuild from 'esbuild';

let context = await esbuild.context( {
    entryPoints: ["scripts/minesweeper.ts", "scripts/pong.ts", "scripts/pongMultiplayer.ts", "scripts/chaosGame.ts"],
    outdir: "js",
    bundle: true,
});

await context.watch()