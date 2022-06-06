import 'zx/globals';

await $`pnpm run make:demo`;

const serveProcess = $`pnpx serve -C -l 3001 ./demo`;

process.on('exit', () => {
	serveProcess.kill();
});
