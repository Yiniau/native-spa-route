import 'zx/globals';

await $`IN_LOCAL=1 pnpm run make:demo`;

// const serveProcess = $`pnpx serve -C -l 3001 ./demo`;
// const serveProcess = $`pnpx web-dev-server --port 3000 --root-dir demo --app-index demo/index.html --open`;
const serveProcess = $`./node_modules/.bin/wds --port 3000 --root-dir demo --app-index demo/index.html --open`;

process.on('exit', () => {
	serveProcess.kill();
});
