import 'zx/globals';

import fs from 'fs-extra';
import path from 'path';
import esbuild from 'esbuild';

const cwd = process.cwd();
const srcPath = path.resolve(cwd, 'src');
const distPath = path.resolve(cwd, 'dist');
const demoPath = path.resolve(cwd, 'demo');
const indexHtmlPath = path.resolve(cwd, 'index.html');

// await fs.mkdir(demoPath, { recursive: true });
fs.removeSync(demoPath);
await fs.mkdir(path.resolve(demoPath, 'dist'), { recursive: true });
await fs.copy(indexHtmlPath, path.resolve(demoPath, 'index.html'));
// await fs.copy(path.resolve(distPath, 'main.es.js'), path.resolve(demoPath, 'dist', 'main.es.js'));
await esbuild.build({
	bundle: true,
	entryPoints: [path.resolve(srcPath, 'main.js')],
	target: 'es2017',
	format: 'esm',
	outfile: path.resolve(demoPath, 'dist', 'main.js'),
});

let indexHtml = await fs.readFile(indexHtmlPath, { encoding: 'utf8' });
indexHtml = indexHtml.replace(/\/\*IMPORTSOURCESTART\*\/.*\/\*IMPORTSOURCEEND\*\//, '"/dist/main.js"');
await fs.writeFile(path.resolve(demoPath, 'index.html'), indexHtml);
