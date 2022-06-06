import 'zx/globals';

import fs from 'fs-extra';
import path from 'path';
import esbuild from 'esbuild';
import esbuildPluginVue from 'esbuild-plugin-vue';

const cwd = process.cwd();
const srcPath = path.resolve(cwd, 'src');
const testPath = path.resolve(cwd, 'test');
// const distPath = path.resolve(cwd, 'dist');
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

let publicPath = '/dist'
if (process.env.IN_LOCAL) {
	publicPath = 'http://localhost:3001/dist';
}

// react 17 build
await $`cd ${path.resolve(testPath, 'react17')} && pnpm i`;
await esbuild.build({
	bundle: true,
	entryPoints: [path.resolve(testPath, 'react17', 'main.jsx')],
	target: 'es2020',
	format: 'esm',
	loader: {
	// 	'.tsx': 'ts'
		'.svg': 'file'
	},
	outfile: path.resolve(demoPath, 'dist', 'react17.js'),
	// plugins: [esbuildSvg()],
	publicPath,
});

// vue 3 build
await $`cd ${path.resolve(testPath, 'vue')} && pnpm i`;
await esbuild.build({
	bundle: true,
	entryPoints: [path.resolve(testPath, 'vue', 'main.js')],
	target: 'es2020',
	format: 'esm',
	loader: {
	// 	'.tsx': 'ts'
		'.svg': 'file',
		'.png': 'file'
	},
	outfile: path.resolve(demoPath, 'dist', 'vue3.js'),
	plugins: [esbuildPluginVue()],
	publicPath,
});

let indexHtml = await fs.readFile(indexHtmlPath, { encoding: 'utf8' });
indexHtml = indexHtml.replace(/\/\*IMPORTSOURCESTART\*\/.*\/\*IMPORTSOURCEEND\*\//g, '"/dist/main.js"');
indexHtml = indexHtml.replaceAll('@PUBLICK_PATH', '/dist');
await fs.writeFile(path.resolve(demoPath, 'index.html'), indexHtml);
